#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
@author: joevest
"""

import os
import json
import requests
import time
from datetime import datetime
from github import Github
import base64

MYTHIC_AGENTS_GITHUB_TOKEN = os.environ.get('MYTHIC_AGENTS_GITHUB_TOKEN')
MYTHIC_C2_GITHUB_TOKEN = os.environ.get('MYTHIC_C2_GITHUB_TOKEN')
api_url_base = "https://api.github.com/repos/"
agent_repos = "agent_repos.txt"  # list of MythicAgent repos
c2_repos = "c2_repos.txt"  # list of MythicC2Profile repos
git_repo_base = "https://github.com/"

datajson = "data.json"
jsonbase = {"data": []}

stats_file = "stats.json"
with open(stats_file) as f:
    stats_data = json.load(f)

#  Walk through MythicAgents list
with open(agent_repos) as f:
    headers = {"authorization": "Bearer " + MYTHIC_AGENTS_GITHUB_TOKEN,
               "Accept": "application/vnd.github+json",
               "X-GitHub-Api-Version": "2022-11-28"}
    g = Github(MYTHIC_AGENTS_GITHUB_TOKEN)
    for repository in f.readlines():
        if repository == "":
            continue  # skip blanks
        else:
            # Get Category and Project from line
            value = repository.split(",")
            category = value[0].strip()
            project = value[1].strip()
            url = api_url_base + project
            # Get GitHub Repo JSON from API
            print(url)
            proj = g.get_repo(project)
            print(f"{proj.name} - {proj.description}")
            default_branch = proj.get_branch(proj.default_branch)
            latest = {
                "branch": default_branch.name,
                "commit_message": default_branch.commit.commit.message,
                "commit_date": default_branch.commit.commit.author.date,
                "icon": "",
            }
            try:
                files = proj.get_contents("agent_icons", ref=default_branch.name)
                for file in files:
                    if file.name.lower() == f"{proj.name}.svg".lower():
                        latest["icon"] = file.download_url
            except Exception as e:
                print(f"Failed to find agent_icons folder for {url} - {e}")

            try:
                for b in proj.get_branches():
                    branch = proj.get_branch(b.name)
                    if branch.commit.commit.author.date > latest["commit_date"]:
                        latest = {
                            "branch": b.name,
                            "commit_message": branch.commit.commit.message,
                            "commit_date": branch.commit.commit.author.date,
                            "icon": latest["icon"]
                        }
                        try:
                            files = proj.get_contents("agent_icons", ref=b.name)
                            for file in files:
                                if file.name.lower() == f"{proj.name}.svg".lower():
                                    latest["icon"] = file.download_url
                        except Exception as e:
                            print(f"Failed to find agent_icons folder for {url} - {e}")
            except Exception as e:
                print(f"Failed to get branches: {e}")
            result = requests.get(url, headers=headers)
            if result.status_code == 200:
                repo_data_json = json.loads(result.text)
                if latest["icon"] == "":
                    latest["icon"] = repo_data_json["owner"]["avatar_url"]
                if len(latest["branch"]) > 20:
                    latest["branch"] = latest["branch"][:20] + "..."
                if len(latest["commit_message"]) > 60:
                    latest["commit_message"] = latest["commit_message"][:60] + "..."
                repo_data_json["latest"] = latest
                # Add custom category field to JSON
                try:
                    files = proj.get_contents("agent_capabilities.json", ref=default_branch.name)
                    capabilities_data = json.loads(base64.b64decode(files.content))
                    repo_data_json["metadata"] = capabilities_data
                except Exception as e:
                    print(f"Failed to find agent_capabilities.json file for {url} - {e}")
                    repo_data_json["metadata"] = {}
                try:
                    files = proj.get_contents("config.json", ref=default_branch.name)
                    installData = json.loads(base64.b64decode(files.content))
                    if "remote_images" in installData:
                        remote_images = []
                        for key, val in installData["remote_images"].items():
                            remote_images.append(val)
                        repo_data_json["remote_images"] = "\n".join(remote_images)
                    else:
                        repo_data_json["remote_images"] = ""
                except Exception as e:
                    print(f"Failed to find config.json file for {url} - {e}")
                    repo_data_json["remote_images"] = ""
                repo_data_json['category'] = category
                repo_data_json["clones"] = {
                    "count": -1,
                    "uniques": -1
                }
                try:
                    clones = proj.get_clones_traffic()
                    repo_data_json["clones"]["count"] = clones["count"]
                    repo_data_json["clones"]["uniques"] = clones["uniques"]
                    print(clones)
                    if url not in stats_data:
                        stats_data[url] = {}
                    for clone in clones["clones"]:
                        cur_time = clone.timestamp.strftime("%Y-%m-%d")
                        if cur_time in stats_data[url]:
                            stats_data[url][cur_time] = {
                                **stats_data[url][cur_time],
                                "clones": {
                                    "unique": clone.uniques,
                                    "count": clone.count
                                }
                            }
                        else:
                            stats_data[url][cur_time] = {
                                "clones": {
                                    "unique": clone.uniques,
                                    "count": clone.count
                                },
                                "traffic": {
                                    "count": 0,
                                    "unique": 0
                                },
                                "referrer": {}
                            }
                    traffic = proj.get_views_traffic()
                    print(traffic)
                    for t in traffic['views']:
                        cur_time = t.timestamp.strftime("%Y-%m-%d")
                        if cur_time in stats_data[url]:
                            stats_data[url][cur_time] = {
                                **stats_data[url][cur_time],
                                "traffic": {
                                    "count": t.count,
                                    "unique": t.uniques
                                }
                            }
                        else:
                            stats_data[url][cur_time] = {
                                "traffic": {
                                    "count": t.count,
                                    "unique": t.uniques
                                },
                                "clones": {
                                    "unique": 0,
                                    "count": 0
                                },
                                "referrer": {}
                            }
                    traffic_view_sources = requests.get(f"{url}/traffic/popular/referrers", headers=headers)
                    if traffic_view_sources.status_code == 200:
                        traffic_sources = json.loads(traffic_view_sources.text)
                        #print(traffic_sources)
                        today = datetime.today().strftime("%Y-%m-%d")
                        referrers = {}
                        for ref in traffic_sources:
                            referrers[ref["referrer"]] = {
                                "count": ref["count"],
                                "unique": ref["uniques"]
                            }
                        if today in stats_data[url]:
                            stats_data[url][today] = {
                                **stats_data[url][today],
                                "referrer": referrers
                            }
                        else:
                            stats_data[url][today] = {
                                "referrer": referrers,
                                "clones": {
                                    "unique": 0,
                                    "count": 0,
                                },
                                "traffic": {
                                    "count": 0,
                                    "unique": 0,
                                }
                            }
                    else:
                        print(f"Failed to get traffic sources\n")
                except Exception as e:
                    print(f"Failed to get traffic for {url} - {e}")
                repo_data_json["latest"]["commit_date"] = time.mktime(
                    repo_data_json["latest"]["commit_date"].timetuple())

                # Add JSON to array
                jsonbase["data"].append(repo_data_json)
            else:
                print("ERROR: Cannot access " + url)

#  Walk through MythicC2Profiles list
with open(c2_repos) as f:
    headers = {"authorization": "Bearer " + MYTHIC_C2_GITHUB_TOKEN,
               "Accept": "application/vnd.github+json",
               "X-GitHub-Api-Version": "2022-11-28"}
    g = Github(MYTHIC_C2_GITHUB_TOKEN)
    for repository in f.readlines():
        if repository == "":
            continue  # skip blanks
        else:
            # Get Category and Project from line
            value = repository.split(",")
            category = value[0].strip()
            project = value[1].strip()
            url = api_url_base + project
            # Get GitHub Repo JSON from API
            print(url)
            try:
                proj = g.get_repo(project)
            except Exception as e:
                print(f"Failed to get repo: {e}\n")
                continue
            print(f"{proj.name} - {proj.description}")
            default_branch = proj.get_branch(proj.default_branch)
            latest = {
                "branch": default_branch.name,
                "commit_message": default_branch.commit.commit.message,
                "commit_date": default_branch.commit.commit.author.date,
            }
            try:
                for b in proj.get_branches():
                    branch = proj.get_branch(b.name)
                    if branch.commit.commit.author.date > latest["commit_date"]:
                        latest = {
                            "branch": b.name,
                            "commit_message": branch.commit.commit.message,
                            "commit_date": branch.commit.commit.author.date,
                        }
            except Exception as e:
                print(f"Failed to get branches: {e}")
            result = requests.get(url, headers=headers)
            if result.status_code == 200:
                repo_data_json = json.loads(result.text)
                latest["icon"] = repo_data_json["owner"]["avatar_url"]
                repo_data_json["latest"] = latest
                # Add custom category field to JSON
                repo_data_json['category'] = category
                try:
                    files = proj.get_contents("config.json", ref=default_branch.name)
                    installData = json.loads(base64.b64decode(files.content))
                    if "remote_images" in installData:
                        remote_images = []
                        for key, val in installData["remote_images"].items():
                            remote_images.append(val)
                        repo_data_json["remote_images"] = "\n".join(remote_images)
                    else:
                        repo_data_json["remote_images"] = ""
                except Exception as e:
                    print(f"Failed to find config.json file for {url} - {e}")
                    repo_data_json["remote_images"] = ""
                try:
                    clones = proj.get_clones_traffic()
                    repo_data_json["clones"] = {}
                    repo_data_json["clones"]["count"] = clones["count"]
                    repo_data_json["clones"]["uniques"] = clones["uniques"]
                    print(clones)
                    if url not in stats_data:
                        stats_data[url] = {}
                    for clone in clones["clones"]:
                        cur_time = clone.timestamp.strftime("%Y-%m-%d")
                        if cur_time in stats_data[url]:
                            stats_data[url][cur_time] = {
                                **stats_data[url][cur_time],
                                "clones": {
                                    "unique": clone.uniques,
                                    "count": clone.count
                                }
                            }
                        else:
                            stats_data[url][cur_time] = {
                                "clones": {
                                    "unique": clone.uniques,
                                    "count": clone.count
                                },
                                "traffic": {
                                    "count": 0,
                                    "unique": 0
                                },
                                "referrer": {}
                            }
                    traffic = proj.get_views_traffic()
                    #print(traffic)
                    for t in traffic['views']:
                        cur_time = t.timestamp.strftime("%Y-%m-%d")
                        if cur_time in stats_data[url]:
                            stats_data[url][cur_time] = {
                                **stats_data[url][cur_time],
                                "traffic": {
                                    "count": t.count,
                                    "unique": t.uniques
                                }
                            }
                        else:
                            stats_data[url][cur_time] = {
                                "traffic": {
                                    "count": t.count,
                                    "unique": t.uniques
                                },
                                "clones": {
                                    "unique": 0,
                                    "count": 0
                                },
                                "referrer": {}
                            }
                    traffic_view_sources = requests.get(f"{url}/traffic/popular/referrers", headers=headers)
                    if traffic_view_sources.status_code == 200:
                        traffic_sources = json.loads(traffic_view_sources.text)
                        #print(traffic_sources)
                        today = datetime.today().strftime("%Y-%m-%d")
                        referrers = {}
                        for ref in traffic_sources:
                            referrers[ref["referrer"]] = {
                                "count": ref["count"],
                                "unique": ref["uniques"]
                            }
                        if today in stats_data[url]:
                            stats_data[url][today] = {
                                **stats_data[url][today],
                                "referrer": referrers
                            }
                        else:
                            stats_data[url][today] = {
                                "referrer": referrers,
                                "clones": {
                                    "unique": 0,
                                    "count": 0,
                                },
                                "traffic": {
                                    "count": 0,
                                    "unique": 0,
                                }
                            }
                    else:
                        print(f"Failed to get traffic sources\n")
                except Exception as e:
                    print(f"Failed to get traffic for {url} - {e}")
                repo_data_json["latest"]["commit_date"] = time.mktime(
                    repo_data_json["latest"]["commit_date"].timetuple())

                # Add JSON to array
                jsonbase["data"].append(repo_data_json)
            else:
                print("ERROR: Cannot access " + url)

with open(datajson, 'w') as f:
    f.write(json.dumps(jsonbase, indent=2))
with open(stats_file, 'w') as f:
    f.write(json.dumps(stats_data, indent=2))
