#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json

stats_file = "stats.json"
with open(stats_file) as f:
    stats_data = json.load(f)

for url, dates in stats_data.items():
    print(url)
    referrer_data = {}
    for date, date_data in dates.items():
        if "referrer" in date_data:
            for referrer_url, referrer_counts in date_data["referrer"].items():
                if referrer_url not in referrer_data:
                    referrer_data[referrer_url] = referrer_counts["count"]
                else:
                    referrer_data[referrer_url] += referrer_counts["count"]
    referrer_tuple = [(y, x) for x, y in referrer_data.items()]
    referrer_tuple.sort(reverse=True)
    for t in referrer_tuple:
        print(f"{t[0]} - {t[1]}")
