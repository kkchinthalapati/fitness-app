import type { WorkoutEntry, WorkoutType } from "../types.ts";
import { calculateWorkoutCalories, getCyclingMET, getRunningMET } from "./workoutCalc.ts";

/**
 * Calculates distance between two GPS coordinates using the Haversine formula in kilometers.
 */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Formats a Date object to YYYY-MM-DD in the user's local timezone.
 */
export function formatLocalDate(d: Date = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Robustly extracts the calendar date (YYYY-MM-DD) from an activity date string,
 * avoiding UTC-induced day shifts for local times.
 */
export function extractActivityDate(dateSource?: string, defaultDate?: string): string {
  if (dateSource && /^\d{4}-\d{2}-\d{2}/.test(dateSource)) {
    return dateSource.slice(0, 10);
  }
  if (dateSource) {
    try {
      const parsed = new Date(dateSource);
      if (!isNaN(parsed.getTime())) {
        return formatLocalDate(parsed);
      }
    } catch {
      // fallback
    }
  }
  return defaultDate || formatLocalDate();
}

/**
 * Normalizes activity type string from Strava to internal WorkoutType.
 */
export function normalizeSportType(stravaType?: string): WorkoutType {
  if (!stravaType) return "other";
  const t = stravaType.toLowerCase().trim();
  if (t.includes("run") || t.includes("jog")) return "running";
  if (t.includes("ride") || t.includes("cycl") || t.includes("bik")) return "cycling";
  if (t.includes("badminton")) return "badminton";
  if (t.includes("cricket")) return "cricket";
  if (t.includes("swim")) return "swimming";
  if (t.includes("walk") || t.includes("hike")) return "walking";
  if (
    t.includes("weight") ||
    t.includes("workout") ||
    t.includes("gym") ||
    t.includes("crossfit") ||
    t.includes("train") ||
    t.includes("strength") ||
    t.includes("hiit") ||
    t.includes("circuit") ||
    t.includes("fitness") ||
    t.includes("calisthenic") ||
    t.includes("pilates") ||
    t.includes("yoga")
  )
    return "gym";
  return "other";
}

/**
 * Parses a Strava / standard GPX XML string into a WorkoutEntry.
 */
export function parseGPX(
  xmlContent: string,
  userWeightKg = 58,
  defaultDate?: string
): WorkoutEntry {
  const trimmed = xmlContent ? xmlContent.trim() : "";
  if (!trimmed) {
    throw new Error("The GPX file is empty. Please provide a valid GPX workout file.");
  }

  // Extract activity name
  const nameMatch = trimmed.match(/<name>(.*?)<\/name>/i);
  const title = nameMatch ? nameMatch[1].trim() : "Strava Activity (GPX)";

  // Extract type
  const typeMatch = trimmed.match(/<type>(.*?)<\/type>/i);
  const detectedType = normalizeSportType(typeMatch ? typeMatch[1] : title);

  // Extract track and route points with coordinates and timestamps
  // Supports lat/lon in any order, with double or single quotes
  const ptRegex = /<(?:trkpt|rtept)\s+([^>]+)>([\s\S]*?)<\/(?:trkpt|rtept)>/gi;
  let match: RegExpExecArray | null;
  const points: { lat: number; lon: number; time?: number }[] = [];

  while ((match = ptRegex.exec(trimmed)) !== null) {
    const attrStr = match[1];
    const bodyStr = match[2];

    const latMatch = attrStr.match(/lat=["']([^"']+)["']/i);
    const lonMatch = attrStr.match(/lon=["']([^"']+)["']/i);

    if (latMatch && lonMatch) {
      const lat = parseFloat(latMatch[1]);
      const lon = parseFloat(lonMatch[1]);
      let time: number | undefined;

      const timeMatch = bodyStr.match(/<time>([^<]+)<\/time>/i);
      if (timeMatch) {
        const parsedTime = new Date(timeMatch[1]).getTime();
        if (!isNaN(parsedTime)) {
          time = parsedTime;
        }
      }

      if (!isNaN(lat) && !isNaN(lon)) {
        points.push({ lat, lon, time });
      }
    }
  }

  // Also support self-closing tags: <trkpt lat="..." lon="..." />
  if (points.length === 0) {
    const scRegex = /<(?:trkpt|rtept)\s+([^>]+?)\/>/gi;
    let scMatch: RegExpExecArray | null;
    while ((scMatch = scRegex.exec(trimmed)) !== null) {
      const attrStr = scMatch[1];
      const latMatch = attrStr.match(/lat=["']([^"']+)["']/i);
      const lonMatch = attrStr.match(/lon=["']([^"']+)["']/i);
      if (latMatch && lonMatch) {
        const lat = parseFloat(latMatch[1]);
        const lon = parseFloat(lonMatch[1]);
        if (!isNaN(lat) && !isNaN(lon)) {
          points.push({ lat, lon });
        }
      }
    }
  }

  // If no GPS coordinates or valid points found and no activity time
  const globalTimeMatch = trimmed.match(/<time>([^<]+)<\/time>/i);
  if (points.length === 0 && !globalTimeMatch) {
    throw new Error("No GPS track points or timestamps found in GPX file.");
  }

  // Calculate distance
  let totalDistKm = 0;
  for (let i = 1; i < points.length; i++) {
    totalDistKm += haversineDistanceKm(
      points[i - 1].lat,
      points[i - 1].lon,
      points[i].lat,
      points[i].lon
    );
  }

  // Calculate duration in minutes from track points timestamps
  let durationMinutes = 30; // fallback if timestamps are completely omitted
  let activityDate = defaultDate || formatLocalDate();

  const timedPoints = points.filter((p) => p.time !== undefined);
  if (timedPoints.length >= 2) {
    const startTime = timedPoints[0].time!;
    const endTime = timedPoints[timedPoints.length - 1].time!;
    const diffMin = (endTime - startTime) / 60000;
    if (diffMin > 0) durationMinutes = Math.round(diffMin);
    activityDate = extractActivityDate(new Date(startTime).toISOString(), defaultDate);
  } else if (globalTimeMatch) {
    try {
      activityDate = extractActivityDate(globalTimeMatch[1], defaultDate);
    } catch {
      // fallback
    }
  }

  // Calculate calorie burn
  const speedKmh = durationMinutes > 0 ? (totalDistKm / (durationMinutes / 60)) : 0;
  let met: number | undefined;

  if (detectedType === "running" && speedKmh > 0) {
    met = getRunningMET(speedKmh);
  } else if (detectedType === "cycling" && speedKmh > 0) {
    met = getCyclingMET(speedKmh);
  }

  const caloriesBurned = calculateWorkoutCalories(detectedType, durationMinutes, userWeightKg, met);

  return {
    id: `strava-gpx-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    date: activityDate,
    title,
    type: detectedType,
    durationMinutes: Math.max(1, durationMinutes),
    caloriesBurned,
    distanceKm: totalDistKm > 0 ? Number(totalDistKm.toFixed(2)) : undefined,
    source: "strava_gpx",
    createdAt: Date.now(),
  };
}

/**
 * Parses a Strava / Garmin TCX XML string into a WorkoutEntry.
 */
export function parseTCX(
  xmlContent: string,
  userWeightKg = 58,
  defaultDate?: string
): WorkoutEntry {
  const trimmed = xmlContent ? xmlContent.trim() : "";
  if (!trimmed) {
    throw new Error("The TCX file is empty. Please provide a valid TCX workout file.");
  }

  // Activity sport
  const sportMatch = trimmed.match(/<Activity\s+Sport=["']([^"']+)["']/i);
  const detectedType = normalizeSportType(sportMatch ? sportMatch[1] : undefined);

  // Time / Date
  const idMatch = trimmed.match(/<Id>([^<]+)<\/Id>/i);
  let activityDate = defaultDate || formatLocalDate();
  if (idMatch) {
    activityDate = extractActivityDate(idMatch[1], defaultDate);
  }

  // Duration: sum TotalTimeSeconds across laps
  let totalTimeSec = 0;
  const timeMatches = trimmed.matchAll(/<TotalTimeSeconds>([^<]+)<\/TotalTimeSeconds>/gi);
  for (const m of timeMatches) {
    totalTimeSec += parseFloat(m[1]) || 0;
  }
  const durationMinutes = totalTimeSec > 0 ? Math.round(totalTimeSec / 60) : 30;

  // Laps distance vs Trackpoint distance
  // If <Lap ...> tags exist, sum <DistanceMeters> from each lap
  const lapRegex = /<Lap[\s\S]*?<\/Lap>/gi;
  let totalDistM = 0;
  let lapCount = 0;
  let lapMatch: RegExpExecArray | null;

  while ((lapMatch = lapRegex.exec(trimmed)) !== null) {
    lapCount++;
    const lapXml = lapMatch[0];
    const lapDistMatch = lapXml.match(/<DistanceMeters>([^<]+)<\/DistanceMeters>/i);
    if (lapDistMatch) {
      totalDistM += parseFloat(lapDistMatch[1]) || 0;
    }
  }

  // Fallback: If no <Lap> tags or totalDistM is 0, check all <DistanceMeters>
  if (lapCount === 0 || totalDistM === 0) {
    const distMatches = trimmed.matchAll(/<DistanceMeters>([^<]+)<\/DistanceMeters>/gi);
    for (const m of distMatches) {
      const val = parseFloat(m[1]) || 0;
      if (val > totalDistM) totalDistM = val;
    }
  }

  const distanceKm = totalDistM > 0 ? Number((totalDistM / 1000).toFixed(2)) : undefined;

  // Calories tag
  let parsedCalories = 0;
  const calMatches = trimmed.matchAll(/<Calories>([^<]+)<\/Calories>/gi);
  for (const m of calMatches) {
    parsedCalories += parseFloat(m[1]) || 0;
  }

  // Average Heart Rate
  let avgHr: number | undefined;
  const hrMatch = trimmed.match(/<AverageHeartRateBpm>[\s\S]*?<Value>([^<]+)<\/Value>[\s\S]*?<\/AverageHeartRateBpm>/i);
  if (hrMatch) {
    avgHr = Math.round(parseFloat(hrMatch[1]));
  }

  const finalCalories =
    parsedCalories > 0
      ? Math.round(parsedCalories)
      : calculateWorkoutCalories(detectedType, durationMinutes, userWeightKg);

  return {
    id: `strava-tcx-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    date: activityDate,
    title: `Strava ${sportMatch ? sportMatch[1] : "Activity"}`,
    type: detectedType,
    durationMinutes: Math.max(1, durationMinutes),
    caloriesBurned: finalCalories,
    distanceKm,
    avgHeartRate: avgHr,
    source: "strava_tcx",
    createdAt: Date.now(),
  };
}

export interface StravaRawActivity {
  id?: number | string;
  name?: string;
  type?: string;
  sport_type?: string;
  distance?: number; // meters
  moving_time?: number; // seconds
  elapsed_time?: number; // seconds
  calories?: number;
  kilojoules?: number;
  average_heartrate?: number;
  start_date_local?: string;
  start_date?: string;
  description?: string;
}

/**
 * Parses Strava JSON (either single activity or export array) into WorkoutEntry[].
 */
export function parseStravaJSON(
  jsonContent: string | object,
  userWeightKg = 58,
  sourceOverride?: "strava_api" | "strava_json"
): WorkoutEntry[] {
  let data: unknown;
  if (typeof jsonContent === "string") {
    try {
      data = JSON.parse(jsonContent);
    } catch {
      throw new Error("Invalid JSON file. Please provide a valid Strava JSON export.");
    }
  } else {
    data = jsonContent;
  }

  const list: StravaRawActivity[] = Array.isArray(data)
    ? (data as StravaRawActivity[])
    : [data as StravaRawActivity];

  const results: WorkoutEntry[] = [];
  const source: "strava_api" | "strava_json" = sourceOverride || "strava_json";

  for (const act of list) {
    if (!act || typeof act !== "object") continue;

    const title = act.name || "Strava Workout";
    const typeStr = act.sport_type || act.type || "Workout";
    const detectedType = normalizeSportType(typeStr);

    const seconds = act.moving_time || act.elapsed_time || 1800;
    const durationMinutes = Math.max(1, Math.round(seconds / 60));

    const distanceKm =
      act.distance && act.distance > 0 ? Number((act.distance / 1000).toFixed(2)) : undefined;

    const speedKmh =
      distanceKm && durationMinutes > 0 ? distanceKm / (durationMinutes / 60) : 0;
    let met: number | undefined;
    if (detectedType === "running" && speedKmh > 0) {
      met = getRunningMET(speedKmh);
    } else if (detectedType === "cycling" && speedKmh > 0) {
      met = getCyclingMET(speedKmh);
    }

    let cal = act.calories;
    if (!cal && act.kilojoules) {
      // 1 kJ ≈ 1 kcal of mechanical work assuming ~24% human gross efficiency
      cal = Math.round(act.kilojoules * 1.05);
    }
    if (!cal || cal <= 0) {
      cal = calculateWorkoutCalories(detectedType, durationMinutes, userWeightKg, met);
    }

    const dateStr = extractActivityDate(act.start_date_local || act.start_date);

    const entryId = act.id
      ? `${source === "strava_api" ? "strava-api" : "strava-json"}-${act.id}`
      : `${source === "strava_api" ? "strava-api" : "strava-json"}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    results.push({
      id: entryId,
      date: dateStr,
      title,
      type: detectedType,
      durationMinutes,
      caloriesBurned: Math.round(cal),
      distanceKm,
      avgHeartRate: act.average_heartrate ? Math.round(act.average_heartrate) : undefined,
      source,
      stravaActivityId: act.id ? String(act.id) : undefined,
      notes: act.description || undefined,
      createdAt: Date.now(),
    });
  }

  return results;
}

/**
 * Universal auto-detector for uploaded Strava file: detects GPX, TCX, or JSON.
 */
export function parseStravaFile(
  content: string,
  fileName: string,
  userWeightKg = 58
): WorkoutEntry[] {
  if (!content || !content.trim()) {
    throw new Error("Uploaded file is empty. Please select a valid workout file.");
  }

  const lowerName = fileName ? fileName.toLowerCase() : "";
  const trimmed = content.trim();

  // GPX detection: by extension, <gpx root tag, or <trkpt / <rtept
  if (
    lowerName.endsWith(".gpx") ||
    trimmed.includes("<gpx") ||
    trimmed.includes("<trkpt") ||
    trimmed.includes("<rtept")
  ) {
    return [parseGPX(trimmed, userWeightKg)];
  }

  // TCX detection: by extension, TrainingCenterDatabase, <Activity, or <Lap
  if (
    lowerName.endsWith(".tcx") ||
    trimmed.includes("<TrainingCenterDatabase") ||
    trimmed.includes("<Activity") ||
    trimmed.includes("<Lap")
  ) {
    return [parseTCX(trimmed, userWeightKg)];
  }

  // JSON detection: by extension or starting with JSON array/object brackets
  if (
    lowerName.endsWith(".json") ||
    trimmed.startsWith("{") ||
    trimmed.startsWith("[")
  ) {
    return parseStravaJSON(trimmed, userWeightKg);
  }

  throw new Error("Unrecognized workout file format. Please upload a Strava GPX, TCX, or JSON file.");
}

/**
 * Strava API Client helper to fetch recent activities.
 */
export async function fetchStravaActivities(
  accessToken: string,
  afterTimestamp?: number,
  perPage = 30
): Promise<StravaRawActivity[]> {
  const url = new URL("https://www.strava.com/api/v3/athlete/activities");
  url.searchParams.set("per_page", String(perPage));
  if (afterTimestamp) {
    url.searchParams.set("after", String(afterTimestamp));
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error(
        "Strava API rate limit exceeded (100 requests per 15 minutes). Please wait a few minutes before syncing again."
      );
    }
    const errorText = await response.text();
    throw new Error(`Strava API error (${response.status}): ${errorText}`);
  }

  return response.json();
}

export interface StravaTokenResponse {
  token_type: string;
  access_token: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  athlete?: {
    id: number;
    username?: string;
    firstname?: string;
    lastname?: string;
  };
}

/**
 * Constructs the 1-click Strava OAuth authorization URL.
 */
export function getStravaAuthorizeUrl(
  clientId: string,
  redirectUri: string,
  scope = "read,activity:read_all"
): string {
  const url = new URL("https://www.strava.com/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("approval_prompt", "auto");
  url.searchParams.set("scope", scope);
  return url.toString();
}

/**
 * Exchanges the 1-time OAuth authorization code for access and refresh tokens.
 */
export async function exchangeStravaToken(
  clientId: string,
  clientSecret: string,
  code: string
): Promise<StravaTokenResponse> {
  const response = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error(
        "Strava API rate limit exceeded (100 requests per 15 minutes). Please wait a few minutes before trying again."
      );
    }
    const errorText = await response.text();
    throw new Error(`Strava token exchange failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Seamlessly refreshes an expired Strava access token using the refresh token.
 */
export async function refreshStravaToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<StravaTokenResponse> {
  const response = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      throw new Error(
        "Strava API rate limit exceeded (100 requests per 15 minutes). Please wait a few minutes before syncing again."
      );
    }
    const errorText = await response.text();
    throw new Error(`Strava token refresh failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Checks if the Strava access token is expired or within the buffer window.
 */
export function isStravaTokenExpired(expiresAt?: number, bufferSeconds = 300): boolean {
  if (!expiresAt) return false;
  const currentEpochSec = Math.floor(Date.now() / 1000);
  return expiresAt - bufferSeconds <= currentEpochSec;
}

/**
 * Deduplicates parsed Strava activities against existing workouts by stravaActivityId.
 */
export function deduplicateStravaActivities(
  newWorkouts: WorkoutEntry[],
  existingWorkouts: WorkoutEntry[]
): { uniqueWorkouts: WorkoutEntry[]; duplicateCount: number } {
  const existingStravaIds = new Set<string>();
  const existingIds = new Set<string>();
  for (const w of existingWorkouts) {
    if (w.id) existingIds.add(w.id);
    if (w.stravaActivityId) {
      existingStravaIds.add(String(w.stravaActivityId));
    }
  }

  const seenInBatch = new Set<string>();
  const seenIdsInBatch = new Set<string>();
  const uniqueWorkouts: WorkoutEntry[] = [];
  let duplicateCount = 0;

  for (const w of newWorkouts) {
    const actId = w.stravaActivityId ? String(w.stravaActivityId) : null;
    const isStravaDup = actId ? existingStravaIds.has(actId) || seenInBatch.has(actId) : false;
    const isIdDup = w.id ? existingIds.has(w.id) || seenIdsInBatch.has(w.id) : false;

    if (isStravaDup || isIdDup) {
      duplicateCount++;
      continue;
    }
    if (actId) {
      seenInBatch.add(actId);
    }
    if (w.id) {
      seenIdsInBatch.add(w.id);
    }
    uniqueWorkouts.push(w);
  }

  return { uniqueWorkouts, duplicateCount };
}

export interface SyncStravaOptions {
  clientId?: string;
  clientSecret?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
  userWeightKg?: number;
  existingWorkouts?: WorkoutEntry[];
  afterTimestamp?: number;
  onTokenRefreshed?: (tokens: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  }) => Promise<void> | void;
}

export interface StravaSyncResult {
  success: boolean;
  syncedWorkouts: WorkoutEntry[];
  newCount: number;
  skippedCount: number;
  totalBurnedKcal: number;
  refreshedToken?: string;
  refreshedExpiresAt?: number;
  error?: string;
}

/**
 * Comprehensive Strava synchronization engine:
 * 1. Checks token freshness and refreshes proactively if expired.
 * 2. Fetches recent athlete activities from the Strava API.
 * 3. Normalizes sport types, MET-based calories, duration, and pace.
 * 4. Deduplicates strictly against existing workouts by stravaActivityId.
 */
export async function syncStravaActivities(
  options: SyncStravaOptions
): Promise<StravaSyncResult> {
  let activeToken = options.accessToken || "";
  const tokenExpiresAt = options.tokenExpiresAt;
  let refreshed = false;
  let newRefreshToken: string | undefined;
  let newExpiresAt: number | undefined;

  // Check if token needs proactive refresh
  const shouldRefresh =
    (!activeToken || isStravaTokenExpired(tokenExpiresAt)) &&
    Boolean(options.clientId && options.clientSecret && options.refreshToken);

  if (shouldRefresh) {
    const refreshedData = await refreshStravaToken(
      options.clientId!,
      options.clientSecret!,
      options.refreshToken!
    );
    activeToken = refreshedData.access_token;
    newRefreshToken = refreshedData.refresh_token;
    newExpiresAt = refreshedData.expires_at;
    refreshed = true;
    if (options.onTokenRefreshed) {
      await options.onTokenRefreshed({
        accessToken: activeToken,
        refreshToken: newRefreshToken,
        expiresAt: newExpiresAt,
      });
    }
  }

  if (!activeToken) {
    throw new Error(
      "Strava is not connected. Please provide an Access Token or configure Client ID + Secret + Refresh Token."
    );
  }

  // Fetch activities from Strava API
  let rawActivities: StravaRawActivity[];
  try {
    rawActivities = await fetchStravaActivities(activeToken, options.afterTimestamp);
  } catch (err: unknown) {
    // If 401 Unauthorized occurs and we haven't refreshed yet, attempt refresh once as fallback
    if (
      !refreshed &&
      options.clientId &&
      options.clientSecret &&
      options.refreshToken &&
      err instanceof Error &&
      err.message.includes("401")
    ) {
      const refreshedData = await refreshStravaToken(
        options.clientId,
        options.clientSecret,
        options.refreshToken
      );
      activeToken = refreshedData.access_token;
      newRefreshToken = refreshedData.refresh_token;
      newExpiresAt = refreshedData.expires_at;
      refreshed = true;
      if (options.onTokenRefreshed) {
        await options.onTokenRefreshed({
          accessToken: activeToken,
          refreshToken: newRefreshToken,
          expiresAt: newExpiresAt,
        });
      }
      rawActivities = await fetchStravaActivities(activeToken, options.afterTimestamp);
    } else {
      throw err;
    }
  }

  const userWeight = options.userWeightKg || 58;
  const parsedWorkouts = parseStravaJSON(rawActivities, userWeight, "strava_api");
  const existing = options.existingWorkouts || [];
  const { uniqueWorkouts, duplicateCount } = deduplicateStravaActivities(parsedWorkouts, existing);

  const totalBurnedKcal = uniqueWorkouts.reduce((sum, w) => sum + (w.caloriesBurned || 0), 0);

  return {
    success: true,
    syncedWorkouts: uniqueWorkouts,
    newCount: uniqueWorkouts.length,
    skippedCount: duplicateCount,
    totalBurnedKcal,
    refreshedToken: refreshed ? activeToken : undefined,
    refreshedExpiresAt: refreshed ? newExpiresAt : undefined,
  };
}
