export interface TripMindPreferenceMetadata {
  budget: string
  vibe: string
  pace: string
  dietary: string
  stay: string
  group: string
}

export interface TripMindUserMetadata {
  preferences: TripMindPreferenceMetadata
  profileInitializedAt: string
  profileVersion: number
}

export const defaultTripMindMetadata = (): TripMindUserMetadata => ({
  preferences: {
    budget: '$$ (Mid-range)',
    vibe: 'Relaxed',
    pace: 'Slow explorer',
    dietary: 'Vegetarian',
    stay: 'Boutique hotels',
    group: 'Solo',
  },
  profileInitializedAt: new Date().toISOString(),
  profileVersion: 1,
})

export const normalizeTripMindMetadata = (
  candidate: Partial<TripMindUserMetadata> | null | undefined
): TripMindUserMetadata => {
  const defaults = defaultTripMindMetadata()

  return {
    preferences: {
      budget: candidate?.preferences?.budget ?? defaults.preferences.budget,
      vibe: candidate?.preferences?.vibe ?? defaults.preferences.vibe,
      pace: candidate?.preferences?.pace ?? defaults.preferences.pace,
      dietary: candidate?.preferences?.dietary ?? defaults.preferences.dietary,
      stay: candidate?.preferences?.stay ?? defaults.preferences.stay,
      group: candidate?.preferences?.group ?? defaults.preferences.group,
    },
    profileInitializedAt: candidate?.profileInitializedAt ?? defaults.profileInitializedAt,
    profileVersion: candidate?.profileVersion ?? defaults.profileVersion,
  }
}
