"""Convert Base44 CSV exports into supabase/seed.sql.

Usage: python3 scripts/import_base44.py <folder-with-csvs> supabase/seed.sql
Expects files whose names contain Trip_export, TripDay_export, TrailSegment_export,
SegmentProgress_export and EnrichmentContent_export.
"""
import csv, glob, json, os, re, sys, uuid

src, out = sys.argv[1], sys.argv[2]


def load(tag):
    files = [f for f in glob.glob(os.path.join(src, '*.csv')) if re.search(rf'(^|[-_/]){tag}_export', os.path.basename(f))]
    if not files:
        sys.exit(f'missing {tag}_export csv')
    with open(files[0], encoding='utf-8') as fh:
        return list(csv.DictReader(fh))


def q(v):
    if v is None:
        return 'null'
    if isinstance(v, bool):
        return 'true' if v else 'false'
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def num(v):
    v = (v or '').strip()
    try:
        return float(v) if v else None
    except ValueError:
        return None


def boolish(v):
    return {'true': True, 'false': False}.get((v or '').strip().lower())


def has(name, text):
    """Whole-word match, so that יקום does not match inside מיקום."""
    # allow Hebrew prefix letters (ב, ל, מ, ו...) before the name
    m = re.search(rf'(?:^|[^\u05d0-\u05ea])(?:[ובלמהשכ]{{0,2}}){re.escape(name)}(?![\u05d0-\u05ea])', text)
    return m.start() if m else -1


def norm(s):
    return re.sub(r'["״׳\'`]', '', s or '').replace('־', ' ').strip()


segments = load('TrailSegment')
trips = load('Trip')
days = load('TripDay')
progress = load('SegmentProgress')
enrich = load('EnrichmentContent')

lines = ['-- נוצר אוטומטית מקובצי הייצוא של Base44. מריצים אחרי 0001_schema.sql.', 'begin;']

# ── segments
for s in sorted(segments, key=lambda r: int(r['official_segment_number'])):
    lines.append(
        'insert into segments (number,name,start_name,end_name,region,official_km,seasons,notes,source_url) values ('
        + ','.join(q(x) for x in [int(s['official_segment_number']), s['name'], s['start_point_name'], s['end_point_name'],
                                  s['region'], num(s['distance_km']), s['recommended_seasons'], s['notes'], s['official_source_url']])
        + ');')

# ── trips
STATUS = {'planned': 'planned', 'completed': 'completed', 'to_be_rescheduled': 'to_reschedule', 'cancelled': 'cancelled'}
trip_uuid = {}
for t in trips:
    tid = str(uuid.uuid5(uuid.NAMESPACE_URL, 'base44-trip-' + t['id']))
    trip_uuid[t['id']] = tid
    segs = json.loads(t['segment_numbers'] or '[]')
    if t['reserve_trip'] == 'true' or t['trip_type'] == 'reserve':
        kind = 'reserve'
    elif t['trip_type'] == 'closing' or t['participation_type'] == 'mitzvah':
        kind = 'mitzvah'
    elif not segs and t['participation_type'] == 'rest':
        kind = 'blocked'
    else:
        kind = 'regular'
    date_status = 'confirmed' if t['confirmed_date'] == 'true' else 'proposed'
    lines.append(
        'insert into trips (id,legacy_id,title,summary,region,start_date,end_date,date_status,status,kind,drive_time,total_km_hint,difficulty,'
        'cover_url,notes,family_activity,dog_allowed,dog_notes,weather_note,area_closures,flood_alert,route_changes,recap) values ('
        + ','.join(q(x) for x in [
            tid, t['id'], t['title'], t['short_description'], t['region'], t['start_date'] or None, t['end_date'] or None,
            date_status, STATUS.get(t['status'], 'planned'), kind, t['drive_time'] if t['drive_time'] != '—' else '',
            num(t['total_distance_km']), t['difficulty'], t['cover_image'], t['general_notes'],
            '\n\n'.join(x for x in [t['family_activity'], t['opening_ceremony']] if x),
            boolish(t['dog_allowed']), t['dog_notes'], t['weather_note'], t['area_closures'], t['flood_alert'],
            t['route_changes_note'], t['completed_recap']])
        + ');')

# ── trip days
done_by_trip = {}
for p in progress:
    for sec in json.loads(p['remaining_sections'] or '[]') + json.loads(p['completed_sections'] or '[]'):
        if p['status'] in ('partial', 'completed') and sec.get('trip_id'):
            done_by_trip[sec['trip_id']] = (p['status'], int(p['segment_number']))

YOUNG_TYPE = {'start_together': 'together', 'join_end': 'join_end', 'parallel': 'parallel'}
day_uuid = {}
for d in days:
    if d['trip_id'] not in trip_uuid:
        print('skip orphan day', d['title'], file=sys.stderr)
        continue
    did = str(uuid.uuid5(uuid.NAMESPACE_URL, 'base44-day-' + d['id']))
    day_uuid[d['id']] = did
    trip = next(t for t in trips if t['id'] == d['trip_id'])
    completion, completed_km, note = 'none', None, ''
    if trip['status'] == 'completed':
        st = done_by_trip.get(d['trip_id'], ('completed', None))[0]
        completion = 'partial' if st == 'partial' else 'completed'
        completed_km = num(trip['completed_distance_km']) or num(trip['total_distance_km'])
        note = 'יובא מ-Base44: הק"מ שנהלכו בפועל. יש לוודא כמה מהם על שביל ישראל.'
    shuttle = True if d['car_shuttle_required'] == 'true' else None
    seg = int(d['segment_number']) if d['segment_number'] else None
    lines.append(
        'insert into trip_days (id,legacy_id,trip_id,date,day_number,segment_number,kind,title,start_name,start_url,end_name,end_url,'
        'distance_km,trail_km,partial_route,duration_text,difficulty,ascent_m,descent_m,route_type,route_description,route_map_url,'
        'main_participants,sun_exposure,water_liters,water_guidance,water_crossing,max_water_depth,escape_points,safety_notes,gear,'
        'shuttle_required,shuttle_details,parking_notes,drive_minutes,young_enabled,young_title,young_type,young_start,young_end,young_km,'
        'young_route_type,young_duration,young_difficulty,young_meetup,young_notes,verification,verification_source,verification_url,'
        'completion,completed_km,completion_note) values ('
        + ','.join(q(x) for x in [
            did, d['id'], trip_uuid[d['trip_id']], d['date'] or None, int(d['day_number'] or 1), seg, d['day_type'] or 'split',
            d['title'], d['start_point_name'], d['start_point_maps_url'], d['end_point_name'], d['end_point_maps_url'],
            num(d['distance_km']), num(d['israel_trail_distance_km']), d['partial_route'] == 'true', d['estimated_duration'],
            d['difficulty'], int(num(d['ascent'])) if num(d['ascent']) is not None else None,
            int(num(d['descent'])) if num(d['descent']) is not None else None, d['route_type'], d['route_description'],
            d['route_map_image'], d['main_participants'], d['sun_exposure'], num(d['water_per_person_liters']),
            d['water_guidance'], '' if d['water_crossing'] == 'none' else d['water_crossing'], d['max_water_depth'],
            d['escape_points'], d['safety_notes'], d['gear_special'], shuttle, d['car_shuttle_instructions'],
            '\n'.join(x for x in [d['parking_notes'], d['car_access_notes']] if x),
            int(num(d['drive_time_minutes'])) if num(d['drive_time_minutes']) is not None else None,
            d['young_trail_enabled'] == 'true', d['young_trail_title'], YOUNG_TYPE.get(d['young_trail_type'], ''),
            d['young_trail_start_point'], d['young_trail_end_point'], num(d['young_trail_distance_km']),
            d['young_trail_route_type'], d['young_trail_duration'], d['young_trail_difficulty'], d['young_trail_meetup'],
            d['young_trail_notes'], d['verification_status'], d['verification_source_name'], d['verification_source_url'],
            completion, completed_km, note])
        + ');')

# ── enrichment: the old links point to days that no longer exist, so match by place names to a segment
seg_names = [(int(s['official_segment_number']), norm(s['start_point_name']), norm(s['end_point_name'])) for s in segments]
unmatched = 0
def match_segment(text):
    best = None
    for n, a, b in seg_names:
        pa, pb = (has(a, text) if a else -1), (has(b, text) if b else -1)
        score = int(pa >= 0) + int(pb >= 0)
        # tie-break: the segment whose start name appears earliest in the text
        pos = pa if pa >= 0 else 999
        if score and (best is None or score > best[0] or (score == best[0] and pos < best[2])):
            best = (score, n, pos)
    return best


for e in enrich:
    best = match_segment(norm(e['location']))
    if best is None or best[0] < 2:
        wider = match_segment(norm(' '.join([e['location'], e['geography'], e['history']])))
        if wider and (best is None or wider[0] > best[0]):
            best = wider
    seg = best[1] if best else None
    if seg is None:
        unmatched += 1
    did = day_uuid.get(e['trip_day_id'])
    lines.append(
        'insert into enrichment (trip_day_id,segment_number,location,geography,nature,history,people_and_culture,things_to_notice,'
        'surprising_facts,trivia_question,trivia_answer,sources,published) values ('
        + ','.join(q(x) for x in [did, seg, e['location'], e['geography'], e['nature'], e['history'], e['people_and_culture'],
                                  e['things_to_notice'], e['surprising_facts'], e['trivia_question'], e['trivia_answer'],
                                  e['sources'], e['published'] == 'true'])
        + ');')

lines.append('commit;')
with open(out, 'w', encoding='utf-8') as fh:
    fh.write('\n'.join(lines) + '\n')
print(f'segments={len(segments)} trips={len(trips)} days={len(day_uuid)} enrichment={len(enrich)} unmatched_enrichment={unmatched}')
