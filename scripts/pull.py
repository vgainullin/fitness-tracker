#!/usr/bin/env python3
"""Pull workout data from Google Sheets to local JSON files."""
import gspread, json, os

gc = gspread.service_account(filename=os.path.expanduser('~/.config/gspread/service_account.json'))
sh = gc.open('Iron Log Data')

os.makedirs('data', exist_ok=True)
for ws in sh.worksheets():
    data = ws.get_all_values()
    name = ws.title.lower()
    records = []
    if len(data) > 1:
        headers = data[0]
        records = [dict(zip(headers, row)) for row in data[1:]]
    with open(f'data/{name}.json', 'w') as f:
        json.dump(records, f, indent=2)
    print(f'{ws.title}: {len(records)} records -> data/{name}.json')
