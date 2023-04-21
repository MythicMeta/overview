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

MYTHIC_AGENTS_GITHUB_TOKEN = os.environ.get('MYTHIC_AGENTS_GITHUB_TOKEN')
MYTHIC_C2_GITHUB_TOKEN = os.environ.get('MYTHIC_C2_GITHUB_TOKEN')
api_url_base = "https://api.github.com/repos/"
agent_repos = "agent_repos.txt"  # list of MythicAgent repos
c2_repos = "c2_repos.txt"  # list of MythicC2Profile repos
git_repo_base = "https://github.com/"

datajson = "data.json"
jsonbase = {"data": []}

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
            latest = {
                "branch": "main",
                "commit_message": "",
                "commit_date": datetime.strptime("1970-01-01 00:00:01", "%Y-%m-%d %H:%M:%S"),
                "icon": "",
            }
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
                        files = proj.get_contents("agent_icons")
                        for file in files:
                            if file.name != ".keep" and file.name != ".gitkeep":
                                latest["icon"] = file.download_url
                    except Exception as e:
                        print(f"Failed to find agent_icons folder for {url} - {e}")
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
                repo_data_json['category'] = category
                repo_data_json["clones"] = {
                    "count": -1,
                    "uniques": -1
                }
                try:
                    clones = proj.get_clones_traffic()
                    repo_data_json["clones"]["count"] = clones["count"]
                    repo_data_json["clones"]["uniques"] = clones["uniques"]
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
            proj = g.get_repo(project)
            print(f"{proj.name} - {proj.description}")
            latest = {
                "branch": "main",
                "commit_message": "",
                "commit_date": datetime.strptime("1970-01-01 00:00:01", "%Y-%m-%d %H:%M:%S"),
            }
            for b in proj.get_branches():
                branch = proj.get_branch(b.name)
                if branch.commit.commit.author.date > latest["commit_date"]:
                    latest = {
                        "branch": b.name,
                        "commit_message": branch.commit.commit.message,
                        "commit_date": branch.commit.commit.author.date,
                    }
            result = requests.get(url, headers=headers)
            if result.status_code == 200:
                repo_data_json = json.loads(result.text)
                latest["icon"] = repo_data_json["owner"]["avatar_url"]
                repo_data_json["latest"] = latest
                # Add custom category field to JSON
                repo_data_json['category'] = category
                clones = proj.get_clones_traffic()
                repo_data_json["clones"] = {}
                repo_data_json["clones"]["count"] = clones["count"]
                repo_data_json["clones"]["uniques"] = clones["uniques"]
                repo_data_json["latest"]["commit_date"] = time.mktime(
                    repo_data_json["latest"]["commit_date"].timetuple())

                # Add JSON to array
                jsonbase["data"].append(repo_data_json)
            else:
                print("ERROR: Cannot access " + url)

with open(datajson, 'w') as f:
    f.write(json.dumps(jsonbase, indent=2))
