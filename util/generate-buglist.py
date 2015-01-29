import json
import requests


bzrest = 'https://bugzilla.mozilla.org/rest/bug'
fields = 'id,creator,resolution,last_change_time,creation_time,'\
    'cf_last_resolved,cf_tracking_e10s'


def get_e10s_bugs():
    trackers = get_e10s_trackers()
    all_bugs = get_e10s_affecting(trackers)
    json.dump(all_bugs, open('data/bug-data.json', 'w'))


def get_e10s_trackers():
    query = {
        'include_fields': fields,
        'f1': 'alias',
        'o1': 'substring',
        'v1': 'e10s',
        'resolution': '---'
    }
    r = requests.get(bzrest, params=query)
    trackers = r.json()['bugs']
    return trackers


def get_e10s_affecting(trackers):
    tracking_ids = [str(bug['id']) for bug in trackers]
    query = {
        'include_fields': fields,
        'j_top': 'OR',
        'f1': 'blocked',
        'o1': 'anywordssubstr',
        'v1': ','.join(tracking_ids),
        'f2': 'cf_tracking_e10s',
        'o2': 'nowordssubstr',
        'v2': '-,?'
    }
    r = requests.get(bzrest, params=query)
    bugs = r.json()['bugs']
    allbugs = dict((bug['id'], bug) for bug in trackers + bugs)
    return allbugs

if __name__ == '__main__':
    get_e10s_bugs()
