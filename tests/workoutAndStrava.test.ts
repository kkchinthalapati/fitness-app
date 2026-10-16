import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  calculateWorkoutCalories,
  getCyclingMET,
  getRunningMET,
} from "../src/utils/workoutCalc.ts";
import {
  parseGPX,
  parseTCX,
  parseStravaJSON,
  parseStravaFile,
  haversineDistanceKm,
  normalizeSportType,
  getStravaAuthorizeUrl,
  exchangeStravaToken,
  refreshStravaToken,
  isStravaTokenExpired,
  deduplicateStravaActivities,
  syncStravaActivities,
  formatLocalDate,
  extractActivityDate,
} from "../src/utils/strava.ts";
import type { WorkoutEntry } from "../src/types.ts";

describe("Workout & Strava Import Test Suite", () => {
  const userWeightKg = 58; // Karthik's weight

  test("MET-based calorie burn calculations for teen activities", () => {
    // Badminton: MET 7.0, 45 min, 58 kg
    // (7.0 * 3.5 * 58 / 200) * 45 = 7.105 * 45 = 319.725 -> 320 kcal
    const badmintonBurn = calculateWorkoutCalories("badminton", 45, userWeightKg);
    assert.equal(badmintonBurn, 320);

    // Cricket: MET 5.0, 60 min, 58 kg
    // (5.0 * 3.5 * 58 / 200) * 60 = 5.075 * 60 = 304.5 -> 305 kcal
    const cricketBurn = calculateWorkoutCalories("cricket", 60, userWeightKg);
    assert.equal(cricketBurn, 305);

    // Running: MET 9.8, 30 min, 58 kg
    // (9.8 * 3.5 * 58 / 200) * 30 = 9.947 * 30 = 298.41 -> 298 kcal
    const runningBurn = calculateWorkoutCalories("running", 30, userWeightKg);
    assert.equal(runningBurn, 298);

    // Zero or negative handling
    assert.equal(calculateWorkoutCalories("running", 0, userWeightKg), 0);
    assert.equal(calculateWorkoutCalories("running", -10, userWeightKg), 0);
  });

  test("Pace/Speed-based MET adjustments", () => {
    assert.equal(getRunningMET(8.0), 8.3);
    assert.equal(getRunningMET(10.5), 11.0);
    assert.equal(getCyclingMET(18.0), 6.0);
    assert.equal(getCyclingMET(24.0), 10.0);
  });

  test("Haversine distance calculation", () => {
    // Distance between Tank Bund / Hussain Sagar (17.4239, 78.4738) and Gachibowli Stadium (17.4435, 78.3494)
    const dist = haversineDistanceKm(17.4239, 78.4738, 17.4435, 78.3494);
    assert.ok(dist >= 12.0 && dist <= 14.0, `Expected ~13 km, got ${dist}`);
  });

  test("Sport type normalizer", () => {
    assert.equal(normalizeSportType("Run"), "running");
    assert.equal(normalizeSportType("VirtualRide"), "cycling");
    assert.equal(normalizeSportType("Badminton"), "badminton");
    assert.equal(normalizeSportType("WeightTraining"), "gym");
    assert.equal(normalizeSportType("Swim"), "swimming");
    assert.equal(normalizeSportType("Hike"), "walking");
  });

  test("Strava GPX file parser with 45-min duration and trackpoint timestamps", () => {
    const sampleGPX45 = `<?xml version="1.0" encoding="UTF-8"?>
<gpx creator="StravaGPX" version="1.1" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <time>2026-10-16T06:00:00Z</time>
  </metadata>
  <trk>
    <name>Morning Run around KBR Park</name>
    <type>running</type>
    <trkseg>
      <trkpt lat="17.4250" lon="78.4150">
        <ele>540.0</ele>
        <time>2026-10-16T06:00:00Z</time>
      </trkpt>
      <trkpt lat="17.4300" lon="78.4200">
        <ele>542.0</ele>
        <time>2026-10-16T06:20:00Z</time>
      </trkpt>
      <trkpt lat="17.4350" lon="78.4250">
        <ele>545.0</ele>
        <time>2026-10-16T06:45:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>`;

    const workout = parseGPX(sampleGPX45, userWeightKg);
    assert.equal(workout.title, "Morning Run around KBR Park");
    assert.equal(workout.type, "running");
    assert.equal(workout.durationMinutes, 45, "Should compute exact 45 minutes from trackpoint timestamps");
    assert.equal(workout.date, "2026-10-16");
    assert.ok(workout.distanceKm && workout.distanceKm > 1.0, `Expected distance > 1km, got ${workout.distanceKm}`);
    assert.ok(workout.caloriesBurned >= 200, `Expected calories >= 200, got ${workout.caloriesBurned}`);
    assert.equal(workout.source, "strava_gpx");
  });

  test("Strava GPX parser handles reverse lon/lat attributes and single quotes", () => {
    const reversedGPX = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <trk>
    <name>Tank Bund Cycling</name>
    <type>cycling</type>
    <trkseg>
      <trkpt lon='78.4738' lat='17.4239'><time>2026-10-16T07:00:00Z</time></trkpt>
      <trkpt lon='78.3494' lat='17.4435'><time>2026-10-16T07:35:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`;

    const workout = parseGPX(reversedGPX, userWeightKg);
    assert.equal(workout.title, "Tank Bund Cycling");
    assert.equal(workout.type, "cycling");
    assert.equal(workout.durationMinutes, 35);
    assert.ok(workout.distanceKm && workout.distanceKm >= 12.0, `Expected distance >= 12km, got ${workout.distanceKm}`);
    assert.ok(workout.caloriesBurned >= 200, `Expected calories >= 200, got ${workout.caloriesBurned}`);
  });

  test("Strava GPX parser throws error on empty or invalid file", () => {
    assert.throws(() => parseGPX(""), /empty/i);
    assert.throws(() => parseGPX("   "), /empty/i);
    assert.throws(() => parseGPX("<gpx><metadata></metadata></gpx>"), /no gps/i);
  });

  test("Strava TCX file parser with direct Calories tag", () => {
    const sampleTCX = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
  <Activities>
    <Activity Sport="Biking">
      <Id>2026-10-16T07:00:00Z</Id>
      <Lap StartTime="2026-10-16T07:00:00Z">
        <TotalTimeSeconds>2400.0</TotalTimeSeconds>
        <DistanceMeters>12500.0</DistanceMeters>
        <Calories>385</Calories>
        <AverageHeartRateBpm>
          <Value>148</Value>
        </AverageHeartRateBpm>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;

    const workout = parseTCX(sampleTCX, userWeightKg);
    assert.equal(workout.type, "cycling");
    assert.equal(workout.durationMinutes, 40);
    assert.equal(workout.caloriesBurned, 385);
    assert.equal(workout.distanceKm, 12.5);
    assert.equal(workout.avgHeartRate, 148);
    assert.equal(workout.source, "strava_tcx");
  });

  test("Strava TCX sums distance across multiple laps", () => {
    const multiLapTCX = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase>
  <Activities>
    <Activity Sport="Running">
      <Id>2026-10-16T06:00:00Z</Id>
      <Lap StartTime="2026-10-16T06:00:00Z">
        <TotalTimeSeconds>600</TotalTimeSeconds>
        <DistanceMeters>2000</DistanceMeters>
        <Calories>150</Calories>
      </Lap>
      <Lap StartTime="2026-10-16T06:10:00Z">
        <TotalTimeSeconds>750</TotalTimeSeconds>
        <DistanceMeters>2500</DistanceMeters>
        <Calories>180</Calories>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;

    const workout = parseTCX(multiLapTCX, userWeightKg);
    assert.equal(workout.type, "running");
    assert.equal(workout.distanceKm, 4.5, "Should sum 2000m + 2500m = 4.5 km");
    assert.equal(workout.durationMinutes, Math.round((600 + 750) / 60)); // 23 min
    assert.equal(workout.caloriesBurned, 330); // 150 + 180
  });

  test("Strava TCX parser throws error on empty file", () => {
    assert.throws(() => parseTCX(""), /empty/i);
    assert.throws(() => parseTCX("   "), /empty/i);
  });

  test("Strava JSON activity parser", () => {
    const sampleJSON = JSON.stringify([
      {
        id: 12345678,
        name: "Evening Badminton Smash Session",
        type: "Workout",
        sport_type: "Badminton",
        moving_time: 3000, // 50 min
        calories: 360,
        average_heartrate: 152,
        start_date_local: "2026-10-16T18:00:00Z",
      },
    ]);

    const workouts = parseStravaJSON(sampleJSON, userWeightKg);
    assert.equal(workouts.length, 1);
    const w = workouts[0];
    assert.equal(w.title, "Evening Badminton Smash Session");
    assert.equal(w.type, "badminton");
    assert.equal(w.durationMinutes, 50);
    assert.equal(w.caloriesBurned, 360);
    assert.equal(w.avgHeartRate, 152);
    assert.equal(w.source, "strava_json");
  });

  test("Universal parseStravaFile auto-detection and validation", () => {
    const gpxStr = `<gpx><trk><name>Ride</name><type>Cycling</type><trkseg><trkpt lat="17" lon="78"><time>2026-10-16T06:00:00Z</time></trkpt><trkpt lat="18" lon="79"><time>2026-10-16T06:30:00Z</time></trkpt></trkseg></trk></gpx>`;
    const fromGpx = parseStravaFile(gpxStr, "activity.gpx", userWeightKg);
    assert.equal(fromGpx[0].source, "strava_gpx");

    // Without .gpx extension
    const fromGpxNoExt = parseStravaFile(gpxStr, "activity_export", userWeightKg);
    assert.equal(fromGpxNoExt[0].source, "strava_gpx");

    const jsonStr = `[{"name": "Run", "type": "Run", "moving_time": 1800, "calories": 250}]`;
    const fromJson = parseStravaFile(jsonStr, "strava_export.json", userWeightKg);
    assert.equal(fromJson[0].source, "strava_json");

    assert.throws(() => parseStravaFile("", "test.gpx"), /empty/i);
    assert.throws(() => parseStravaFile("random non-xml text", "test.txt"), /unrecognized/i);
  });

  test("1-Click OAuth authorize URL generation and token exchange", async () => {
    const authUrl = getStravaAuthorizeUrl("12345", "http://localhost:5173/");
    assert.ok(authUrl.startsWith("https://www.strava.com/oauth/authorize"));
    assert.ok(authUrl.includes("client_id=12345"));
    assert.ok(authUrl.includes("response_type=code"));
    assert.ok(authUrl.includes("redirect_uri=http%3A%2F%2Flocalhost%3A5173%2F"));
    assert.ok(authUrl.includes("scope=read%2Cactivity%3Aread_all"));

    const originalFetch = globalThis.fetch;
    try {
      // Mock successful exchange
      globalThis.fetch = async (url, init) => {
        assert.equal(String(url), "https://www.strava.com/oauth/token");
        assert.equal(init?.method, "POST");
        const body = JSON.parse(String(init?.body));
        assert.equal(body.client_id, "12345");
        assert.equal(body.client_secret, "my_secret");
        assert.equal(body.code, "auth_code_xyz");
        assert.equal(body.grant_type, "authorization_code");

        return {
          ok: true,
          status: 200,
          json: async () => ({
            token_type: "Bearer",
            access_token: "new_access_token_123",
            refresh_token: "new_refresh_token_456",
            expires_at: 1700000000,
            expires_in: 21600,
            athlete: { id: 98765, firstname: "Karthik" },
          }),
        } as unknown as Response;
      };

      const result = await exchangeStravaToken("12345", "my_secret", "auth_code_xyz");
      assert.equal(result.access_token, "new_access_token_123");
      assert.equal(result.refresh_token, "new_refresh_token_456");
      assert.equal(result.expires_at, 1700000000);
      assert.equal(result.athlete?.firstname, "Karthik");

      // Mock exchange failure
      globalThis.fetch = async () => ({
        ok: false,
        status: 400,
        text: async () => '{"message":"Bad Request"}',
      } as unknown as Response);

      await assert.rejects(
        () => exchangeStravaToken("12345", "bad_secret", "invalid_code"),
        /Strava token exchange failed \(400\)/
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("Token expiry detection and refreshStravaToken logic", async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    // Expired in past
    assert.equal(isStravaTokenExpired(nowSec - 100), true);
    // Expiring in 2 minutes (within default 5 minute / 300s buffer)
    assert.equal(isStravaTokenExpired(nowSec + 120), true);
    // Expiring far in future (10 hours)
    assert.equal(isStravaTokenExpired(nowSec + 36000), false);
    // Undefined expiresAt
    assert.equal(isStravaTokenExpired(undefined), false);

    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async (url, init) => {
        assert.equal(String(url), "https://www.strava.com/oauth/token");
        const body = JSON.parse(String(init?.body));
        assert.equal(body.grant_type, "refresh_token");
        assert.equal(body.client_id, "id_101");
        assert.equal(body.client_secret, "sec_101");
        assert.equal(body.refresh_token, "ref_101");

        return {
          ok: true,
          status: 200,
          json: async () => ({
            token_type: "Bearer",
            access_token: "refreshed_access_token",
            refresh_token: "refreshed_refresh_token",
            expires_at: nowSec + 21600,
            expires_in: 21600,
          }),
        } as unknown as Response;
      };

      const refreshed = await refreshStravaToken("id_101", "sec_101", "ref_101");
      assert.equal(refreshed.access_token, "refreshed_access_token");
      assert.equal(refreshed.refresh_token, "refreshed_refresh_token");
      assert.ok(refreshed.expires_at > nowSec);

      // Failure response
      globalThis.fetch = async () => ({
        ok: false,
        status: 401,
        text: async () => '{"message":"Invalid Refresh Token"}',
      } as unknown as Response);

      await assert.rejects(
        () => refreshStravaToken("id_101", "sec_101", "bad_ref"),
        /Strava token refresh failed \(401\)/
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("Activity deduplication strictly preserves uniqueness by stravaActivityId", () => {
    const existingWorkouts: WorkoutEntry[] = [
      {
        id: "strava-api-1001",
        date: "2026-10-15",
        title: "Morning 5k Run",
        type: "running",
        durationMinutes: 28,
        caloriesBurned: 278,
        source: "strava_api",
        stravaActivityId: "1001",
        createdAt: 1000,
      },
      {
        id: "manual-workout-2",
        date: "2026-10-15",
        title: "Badminton",
        type: "badminton",
        durationMinutes: 45,
        caloriesBurned: 320,
        source: "manual",
        createdAt: 2000,
      },
    ];

    const incomingWorkouts: WorkoutEntry[] = [
      // Duplicate of existing workout 1001
      {
        id: "strava-api-1001",
        date: "2026-10-15",
        title: "Morning 5k Run",
        type: "running",
        durationMinutes: 28,
        caloriesBurned: 278,
        source: "strava_api",
        stravaActivityId: "1001",
        createdAt: 3000,
      },
      // New workout 1002
      {
        id: "strava-api-1002",
        date: "2026-10-16",
        title: "Evening Cycling to Durgam Cheruvu",
        type: "cycling",
        durationMinutes: 40,
        caloriesBurned: 350,
        source: "strava_api",
        stravaActivityId: "1002",
        createdAt: 4000,
      },
      // Duplicate within the same incoming batch of 1002
      {
        id: "strava-api-1002",
        date: "2026-10-16",
        title: "Evening Cycling duplicate",
        type: "cycling",
        durationMinutes: 40,
        caloriesBurned: 350,
        source: "strava_api",
        stravaActivityId: "1002",
        createdAt: 5000,
      },
      // New workout 1003
      {
        id: "strava-api-1003",
        date: "2026-10-16",
        title: "Badminton Smash Session",
        type: "badminton",
        durationMinutes: 60,
        caloriesBurned: 426,
        source: "strava_api",
        stravaActivityId: "1003",
        createdAt: 6000,
      },
    ];

    const { uniqueWorkouts, duplicateCount } = deduplicateStravaActivities(
      incomingWorkouts,
      existingWorkouts
    );

    assert.equal(duplicateCount, 2, "Should detect 1 existing duplicate and 1 intra-batch duplicate");
    assert.equal(uniqueWorkouts.length, 2, "Should only keep 2 unique workouts (1002 and 1003)");
    assert.equal(uniqueWorkouts[0].stravaActivityId, "1002");
    assert.equal(uniqueWorkouts[1].stravaActivityId, "1003");
  });

  test("syncStravaActivities engine: end-to-end auto token refresh and activity normalization", async () => {
    const originalFetch = globalThis.fetch;
    const nowSec = Math.floor(Date.now() / 1000);

    let tokenRefreshCalled = false;
    let savedNewTokens: { accessToken: string; refreshToken: string; expiresAt: number } | null = null;

    try {
      globalThis.fetch = async (url, init) => {
        const urlStr = String(url);

        if (urlStr.includes("/oauth/token")) {
          tokenRefreshCalled = true;
          return {
            ok: true,
            status: 200,
            json: async () => ({
              token_type: "Bearer",
              access_token: "auto_refreshed_token_777",
              refresh_token: "new_refresh_token_888",
              expires_at: nowSec + 21600,
              expires_in: 21600,
            }),
          } as unknown as Response;
        }

        if (urlStr.includes("/athlete/activities")) {
          // Verify it used the auto-refreshed token
          const authHeader = (init?.headers as Record<string, string>)?.Authorization;
          assert.equal(authHeader, "Bearer auto_refreshed_token_777");

          return {
            ok: true,
            status: 200,
            json: async () => [
              {
                id: 5001,
                name: "Hyderabad 10k Run",
                type: "Run",
                sport_type: "Run",
                moving_time: 3600, // 60 min
                distance: 10000, // 10 km
                average_heartrate: 165,
                start_date_local: "2026-10-16T06:30:00Z",
              },
              {
                id: 5002,
                name: "Old Already Synced Ride",
                type: "Ride",
                sport_type: "Ride",
                moving_time: 1800,
                distance: 12000,
                start_date_local: "2026-10-15T17:00:00Z",
              },
            ],
          } as unknown as Response;
        }

        throw new Error(`Unexpected fetch call to ${urlStr}`);
      };

      const existingWorkouts: WorkoutEntry[] = [
        {
          id: "strava-api-5002",
          date: "2026-10-15",
          title: "Old Already Synced Ride",
          type: "cycling",
          durationMinutes: 30,
          caloriesBurned: 250,
          source: "strava_api",
          stravaActivityId: "5002",
          createdAt: 1000,
        },
      ];

      const syncResult = await syncStravaActivities({
        clientId: "client_123",
        clientSecret: "secret_123",
        refreshToken: "exp_refresh_token",
        tokenExpiresAt: nowSec - 500, // Expired -> must trigger token refresh
        existingWorkouts,
        userWeightKg: 58,
        onTokenRefreshed: async (tokens) => {
          savedNewTokens = tokens;
        },
      });

      assert.equal(tokenRefreshCalled, true, "Should automatically refresh token before API call");
      assert.ok(savedNewTokens !== null);
      assert.equal((savedNewTokens as { accessToken: string } | null)?.accessToken, "auto_refreshed_token_777");
      assert.equal(syncResult.success, true);
      assert.equal(syncResult.newCount, 1, "Should only add the new 5001 run");
      assert.equal(syncResult.skippedCount, 1, "Should skip the 5002 duplicate");
      assert.equal(syncResult.syncedWorkouts.length, 1);

      const run = syncResult.syncedWorkouts[0];
      assert.equal(run.stravaActivityId, "5001");
      assert.equal(run.type, "running");
      assert.equal(run.durationMinutes, 60);
      assert.equal(run.distanceKm, 10.0);
      assert.equal(run.avgHeartRate, 165);
      assert.equal(run.date, "2026-10-16");
      assert.ok(run.caloriesBurned > 500, `Expected 10k 60min run burn > 500 kcal, got ${run.caloriesBurned}`);
      assert.equal(syncResult.totalBurnedKcal, run.caloriesBurned);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("syncStravaActivities fallback on unexpected 401 error", async () => {
    const originalFetch = globalThis.fetch;
    const nowSec = Math.floor(Date.now() / 1000);
    let attempts = 0;

    try {
      globalThis.fetch = async (url, init) => {
        const urlStr = String(url);
        if (urlStr.includes("/oauth/token")) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              token_type: "Bearer",
              access_token: "fallback_refreshed_token",
              refresh_token: "new_refresh_token",
              expires_at: nowSec + 21600,
              expires_in: 21600,
            }),
          } as unknown as Response;
        }

        if (urlStr.includes("/athlete/activities")) {
          attempts++;
          if (attempts === 1) {
            // First attempt returns 401 Unauthorized
            return {
              ok: false,
              status: 401,
              text: async () => '{"message":"Authorization Error"}',
            } as unknown as Response;
          }
          // Second attempt with fallback refreshed token succeeds
          const authHeader = (init?.headers as Record<string, string>)?.Authorization;
          assert.equal(authHeader, "Bearer fallback_refreshed_token");
          return {
            ok: true,
            status: 200,
            json: async () => [],
          } as unknown as Response;
        }

        throw new Error(`Unexpected fetch call to ${urlStr}`);
      };

      const res = await syncStravaActivities({
        clientId: "client_fallback",
        clientSecret: "sec_fallback",
        accessToken: "stale_token",
        refreshToken: "valid_refresh",
        // Not expired according to expiresAt, but Strava server rejects it with 401
        tokenExpiresAt: nowSec + 5000,
        existingWorkouts: [],
      });

      assert.equal(res.success, true);
      assert.equal(attempts, 2, "Should retry activities fetch after 401 refresh");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("syncStravaActivities throws error when no credentials provided", async () => {
    await assert.rejects(
      () => syncStravaActivities({}),
      /Strava is not connected/
    );
  });

  test("formatLocalDate and extractActivityDate preserve local calendar dates without UTC shift", () => {
    // Exact ISO date string with evening timestamp (23:30)
    assert.equal(extractActivityDate("2026-10-16T23:30:00"), "2026-10-16");
    // Early morning timestamp (01:15)
    assert.equal(extractActivityDate("2026-10-16T01:15:00Z"), "2026-10-16");
    // Standard YYYY-MM-DD
    assert.equal(extractActivityDate("2026-10-16"), "2026-10-16");
    // Fallback to defaultDate if missing or invalid
    assert.equal(extractActivityDate("", "2026-10-16"), "2026-10-16");
    assert.equal(extractActivityDate(undefined, "2026-10-15"), "2026-10-15");

    // formatLocalDate formats Date object to YYYY-MM-DD
    const d = new Date(2026, 9, 16, 12, 0, 0); // month 9 is October
    assert.equal(formatLocalDate(d), "2026-10-16");
  });

  test("parseStravaJSON computes pace-based MET for running and cycling when calories are missing", () => {
    // Fast 5k run in 20 min (15 km/h) without calories tag
    const fastRunJSON = JSON.stringify([
      {
        id: 7001,
        name: "Fast 5k Tempo Run",
        type: "Run",
        sport_type: "Run",
        moving_time: 1200, // 20 min
        distance: 5000, // 5 km -> 15 km/h -> MET 12.8
        start_date_local: "2026-10-16T06:30:00Z",
      },
    ]);

    const runWorkouts = parseStravaJSON(fastRunJSON, userWeightKg);
    assert.equal(runWorkouts.length, 1);
    const run = runWorkouts[0];
    assert.equal(run.type, "running");
    assert.equal(run.durationMinutes, 20);
    assert.equal(run.distanceKm, 5.0);
    // (12.8 * 3.5 * 58 / 200) * 20 = 259.968 -> 260 kcal
    assert.equal(run.caloriesBurned, 260);

    // Fast cycling: 12 km in 30 min (24 km/h) -> MET 10.0
    const fastRideJSON = JSON.stringify([
      {
        id: 7002,
        name: "Fast Road Ride",
        type: "Ride",
        sport_type: "Ride",
        moving_time: 1800, // 30 min
        distance: 12000, // 12 km -> 24 km/h -> MET 10.0
        start_date_local: "2026-10-16T17:30:00Z",
      },
    ]);

    const rideWorkouts = parseStravaJSON(fastRideJSON, userWeightKg);
    assert.equal(rideWorkouts.length, 1);
    const ride = rideWorkouts[0];
    assert.equal(ride.type, "cycling");
    // (10.0 * 3.5 * 58 / 200) * 30 = 304.5 -> 305 kcal
    assert.equal(ride.caloriesBurned, 305);
  });

  test("Strava API HTTP 429 rate limit produces user-friendly error message", async () => {
    const originalFetch = globalThis.fetch;
    try {
      globalThis.fetch = async () => ({
        ok: false,
        status: 429,
        text: async () => '{"message":"Rate Limit Exceeded"}',
      } as unknown as Response);

      await assert.rejects(
        () => syncStravaActivities({ accessToken: "test_token" }),
        /rate limit exceeded/i
      );

      await assert.rejects(
        () => exchangeStravaToken("id", "sec", "code"),
        /rate limit exceeded/i
      );

      await assert.rejects(
        () => refreshStravaToken("id", "sec", "ref"),
        /rate limit exceeded/i
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("Extended sport type normalizer covers HIIT, calisthenics, yoga, trail runs, and virtual rides", () => {
    assert.equal(normalizeSportType("HighIntensityIntervalTraining"), "gym");
    assert.equal(normalizeSportType("HIIT"), "gym");
    assert.equal(normalizeSportType("CircuitTraining"), "gym");
    assert.equal(normalizeSportType("Calisthenics"), "gym");
    assert.equal(normalizeSportType("Yoga"), "gym");
    assert.equal(normalizeSportType("Pilates"), "gym");
    assert.equal(normalizeSportType("WeightTraining"), "gym");
    assert.equal(normalizeSportType("Crossfit"), "gym");
    assert.equal(normalizeSportType("TrailRun"), "running");
    assert.equal(normalizeSportType("VirtualRun"), "running");
    assert.equal(normalizeSportType("VirtualRide"), "cycling");
    assert.equal(normalizeSportType("MountainBikeRide"), "cycling");
    assert.equal(normalizeSportType("EBikeRide"), "cycling");
    assert.equal(normalizeSportType("Hike"), "walking");
  });

  test("Multi-date activity syncing preserves distinct activity dates", () => {
    const multiDateJSON = JSON.stringify([
      {
        id: 8001,
        name: "Oct 14 Ride",
        type: "Ride",
        moving_time: 1800,
        distance: 10000,
        start_date_local: "2026-10-14T07:00:00Z",
      },
      {
        id: 8002,
        name: "Oct 15 Run",
        type: "Run",
        moving_time: 1500,
        distance: 4000,
        start_date_local: "2026-10-15T06:30:00Z",
      },
      {
        id: 8003,
        name: "Oct 16 Badminton",
        sport_type: "Badminton",
        moving_time: 2700,
        start_date_local: "2026-10-16T18:00:00Z",
      },
    ]);

    const workouts = parseStravaJSON(multiDateJSON, userWeightKg);
    assert.equal(workouts.length, 3);
    assert.equal(workouts[0].date, "2026-10-14");
    assert.equal(workouts[1].date, "2026-10-15");
    assert.equal(workouts[2].date, "2026-10-16");
  });

  test("Deduplication catches both stravaActivityId and entry ID matches", () => {
    const existing: WorkoutEntry[] = [
      {
        id: "custom-entry-99",
        date: "2026-10-16",
        title: "Workout",
        type: "gym",
        durationMinutes: 30,
        caloriesBurned: 150,
        source: "strava_api",
        createdAt: 100,
      },
    ];

    const incoming: WorkoutEntry[] = [
      {
        id: "custom-entry-99", // same id, no stravaActivityId
        date: "2026-10-16",
        title: "Workout Dup",
        type: "gym",
        durationMinutes: 30,
        caloriesBurned: 150,
        source: "strava_api",
        createdAt: 200,
      },
      {
        id: "custom-entry-100",
        date: "2026-10-16",
        title: "New Workout",
        type: "running",
        durationMinutes: 30,
        caloriesBurned: 298,
        source: "strava_api",
        createdAt: 300,
      },
    ];

    const res = deduplicateStravaActivities(incoming, existing);
    assert.equal(res.duplicateCount, 1);
    assert.equal(res.uniqueWorkouts.length, 1);
    assert.equal(res.uniqueWorkouts[0].id, "custom-entry-100");
  });
});

