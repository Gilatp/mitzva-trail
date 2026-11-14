export type Segment = {
  number: number
  name: string
  start_name: string
  end_name: string
  region: string
  official_km: number | null
}

export type TripStatus = 'planned' | 'to_reschedule' | 'completed' | 'cancelled'
export type TripKind = 'regular' | 'reserve' | 'mitzvah' | 'blocked'

export type Trip = {
  id: string
  title: string
  summary: string
  region: string
  start_date: string | null
  end_date: string | null
  date_status: 'confirmed' | 'proposed'
  status: TripStatus
  kind: TripKind
  drive_time: string
  total_km_hint: number | null
  difficulty: string
  cover_url: string
  notes: string
  family_activity: string
  dog_allowed: boolean | null
  dog_notes: string
  weather_note: string
  area_closures: string
  flood_alert: string
  route_changes: string
  recap: string
}

export type TripDay = {
  id: string
  trip_id: string
  date: string | null
  day_number: number
  segment_number: number | null
  kind: 'split' | 'family' | 'mitzvah'
  title: string
  start_name: string
  start_url: string
  end_name: string
  end_url: string
  distance_km: number | null
  trail_km: number | null
  partial_route: boolean
  duration_text: string
  difficulty: string
  ascent_m: number | null
  descent_m: number | null
  route_type: string
  route_description: string
  route_map_url: string
  main_participants: string
  sun_exposure: string
  water_liters: number | null
  water_guidance: string
  water_crossing: string
  max_water_depth: string
  escape_points: string
  safety_notes: string
  gear: string
  shuttle_required: boolean | null
  shuttle_details: string
  shuttle_drivers: string
  parking_notes: string
  drive_minutes: number | null
  young_enabled: boolean
  young_title: string
  young_type: '' | 'together' | 'join_end' | 'parallel'
  young_start: string
  young_end: string
  young_km: number | null
  young_route_type: string
  young_duration: string
  young_difficulty: string
  young_meetup: string
  young_notes: string
  completion: 'none' | 'partial' | 'completed'
  completed_km: number | null
  completion_note: string
}

export type Enrichment = {
  id: string
  segment_number: number | null
  trip_day_id: string | null
  location: string
  geography: string
  nature: string
  history: string
  people_and_culture: string
  things_to_notice: string
  surprising_facts: string
  trivia_question: string
  trivia_answer: string
  published: boolean
}

export type Profile = {
  id: string
  family_name: string
  contact_name: string
  adults: number
  children_ages: number[]
  role: 'admin' | 'member'
}

export type Registration = {
  id: string
  trip_id: string
  user_id: string
  day_ids: string[]
  adults: number
  children: number
  full_count: number
  arriving_by_car: boolean
  car_seats: number
  consent: boolean
  status: 'active' | 'cancelled'
  admin_note: string
}

export type Ambassador = {
  id: string
  segment_number: number
  user_id: string
  plan: string
  status: 'pending' | 'approved'
}

export type Settings = {
  intro_text: string
  whatsapp_url: string
  organizer_email: string
  blocked_periods: { from: string; to: string; label: string }[]
}
