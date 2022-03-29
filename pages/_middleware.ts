import { NextRequest, NextResponse } from "next/server";

const PUBLIC_FILE = /\.(.*)$/;
const SEGMENT_PAGE_ENDPOINT = "https://api.segment.io/v1/page";
const SEGMENT_TRACK_ENDPOINT = "https://api.segment.io/v1/track";
const SEGMENT_IDENTIFY_ENDPOINT = "https://api.segment.io/v1/identify";

function uuidv4() {
  // @ts-ignore
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
  );
}

const logView = (userId: string, page: string) => {
  fetch(SEGMENT_PAGE_ENDPOINT, {
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      anonymousId: userId,
      writeKey: process.env.SEGMENT_WRITE_KEY,
      name: page,
    }),
    method: "POST",
  }).catch((error) => {
    console.log("An error happened trying to reach Segment:", error);
  });
};

const logEvent = (userId: string, event: string) => {
  fetch(SEGMENT_TRACK_ENDPOINT, {
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      anonymousId: userId,
      writeKey: process.env.SEGMENT_WRITE_KEY,
      event,
    }),
    method: "POST",
  }).catch((error) => {
    console.log("An error happened trying to reach Segment:", error);
  });
};

const identifyUser = (userId: string, req: NextRequest) => {
  console.log("IP: ", req.ip);

  const traits = Object.fromEntries(req.nextUrl.searchParams.entries());
  fetch(SEGMENT_IDENTIFY_ENDPOINT, {
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      anonymousId: userId,
      writeKey: process.env.SEGMENT_WRITE_KEY,
      context: {
        ip: req.ip,
      },
      traits: {
        ...traits,
        ip: req.ip,
      },
    }),
    method: "POST",
  }).catch((error) => {
    console.log("An error happened trying to reach Segment:", error);
  });
};

export function middleware(req: NextRequest) {
  const response = NextResponse.next();

  // we need to skip some request to ensure we are on a proper page view
  const isPageRequest =
    !PUBLIC_FILE.test(req.nextUrl.pathname) &&
    !req.nextUrl.pathname.startsWith("/api") &&
    // headers added when next/link pre-fetches a route
    !req.headers.get("x-middleware-preflight");

  const isAPIRequest =
    !PUBLIC_FILE.test(req.nextUrl.pathname) &&
    req.nextUrl.pathname.startsWith("/api/") &&
    !req.headers.get("x-middleware-preflight");

  // if it's a first time user, we'll add cookie to identify it in subsequent requests
  const userId = req.cookies["userId"] || uuidv4();

  if (isPageRequest || isAPIRequest) {
    // setting a cookie to identify the user on future requests
    if (!req.cookies["userId"]) {
      response.cookie("userId", userId);
    }
    // identify user
    identifyUser(userId, req);
  }

  if (isPageRequest) {
    console.log(`User ${userId} is visiting ${req.nextUrl.pathname}`);
    logView(userId, req.nextUrl.pathname.replace(/\//g, ":"));
  }

  if (isAPIRequest && req.nextUrl.searchParams.get("e")) {
    console.log(`User ${userId} EVENT ${req.nextUrl.searchParams.get("e")}`);
    logEvent(userId, req.nextUrl.searchParams.get("e") || "unknown event");
  }

  return response;
}
