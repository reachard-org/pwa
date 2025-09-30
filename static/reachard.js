// Copyright 2025 Pavel Sobolev
//
// This file is part of the Reachard project, located at
//
//     https://reachard.paveloom.dev
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

import uPlot from "https://cdn.jsdelivr.net/npm/uplot@1/+esm";

const addr = "https://api.reachard.lan.paveloom.dev";
const sessionEndpoint = `${addr}/v0/session/`;
const targetsEndpoint = `${addr}/v0/targets/`;

class View {
  constructor(refName, title, pathnameRegex) {
    this.ref = document.getElementById(`ref-${refName}`);
    this.title = `${title} | Reachard`;
    this.pathnameRegex = pathnameRegex;
  }

  async init() {}

  async set(_data) {
    this.ref.checked = true;
    document.title = this.title;
  }
}

class TargetView extends View {
  element = document.getElementById("view-target");

  constructor() {
    super("target", "Targets", /^\/target\/([0-9]+)\/?$/);
  }

  async deleteTarget(event) {
    const authStoreHandler = new AuthStoreHandler();
    const sessionToken = await authStoreHandler.getSessionToken();

    if (sessionToken === "") {
      return;
    }

    const id = event.target.dataset.id;
    await fetch(`${targetsEndpoint}${id}/`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    });

    const targetsView = new TargetsView();
    targetsView.set();
  }

  async init() {
    const targetDeleteButton = document.getElementById("target-delete-button");
    targetDeleteButton.addEventListener("click", (event) =>
      this.deleteTarget(event),
    );
  }

  async updateIncidentsWidget(id, timeAdded) {
    const authStoreHandler = new AuthStoreHandler();
    const sessionToken = await authStoreHandler.getSessionToken();

    if (sessionToken === "") {
      return;
    }

    const url = new URL(`${targetsEndpoint}${id}/incidents/`);

    const now = Math.floor(Date.now() / 1000);
    const ageHours = Math.floor((now - timeAdded) / (60 * 60));
    const duration = 60 * 60 * 24;

    const since = now - duration;
    url.searchParams.append("since", since);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    });

    const incidents = await response.json();

    const buckets = new Array(24).fill(false);
    for (const timestamp of incidents.timestamps) {
      const hourAgo = Math.floor((now - timestamp) / (60 * 60));
      buckets[hourAgo] = true;
    }

    const targetIncidents = document.getElementById("target-incidents");
    const rects = targetIncidents.querySelectorAll("rect");

    for (let h = 0; h < 24; h++) {
      const rect = rects[23 - h];

      if (h > ageHours) {
        rect.style.fill = "";
        continue;
      }

      if (buckets[h]) {
        rect.style.fill = "red";
      } else {
        rect.style.fill = "green";
      }
    }
  }

  async updateLatenciesWidget(id) {
    const authStoreHandler = new AuthStoreHandler();
    const sessionToken = await authStoreHandler.getSessionToken();

    if (sessionToken === "") {
      return;
    }

    const url = new URL(`${targetsEndpoint}${id}/latencies/`);

    const duration = 60 * 60;
    const defaultStep = 5;
    const displayedStep = 60;

    const since = Math.floor(Date.now() / 1000) - duration;
    url.searchParams.append("since", since);

    const step = Math.floor(displayedStep / defaultStep);
    url.searchParams.append("step", step);

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    });

    const latencies = await response.json();

    let data = [latencies.timestamps, latencies.values];

    let opts = {
      title: "Response time",
      id: "chart1",
      class: "my-chart",
      width: 600,
      height: 600,
      series: [
        {},
        {
          label: "Response time, ms",
          stroke: "green",
          fill: "rgb(0, 125, 0, 0.3)",
          paths: uPlot.paths.bars(),
          points: { show: false },
          gaps: (u, sidx, idx0, idx1, nullGaps) => {
            const isNum = Number.isFinite;
            const delta = displayedStep;

            let xData = u.data[0];
            let yData = u.data[sidx];

            let addlGaps = [];

            for (let i = idx0 + 1; i <= idx1; i++) {
              if (isNum(yData[i]) && isNum(yData[i - 1])) {
                if (xData[i] - xData[i - 1] > delta) {
                  uPlot.addGap(
                    addlGaps,
                    Math.round(u.valToPos(xData[i - 1], "x", true)),
                    Math.round(u.valToPos(xData[i], "x", true)),
                  );
                }
              }
            }

            nullGaps.push(...addlGaps);
            nullGaps.sort((a, b) => a[0] - b[0]);

            return nullGaps;
          },
        },
      ],
    };

    const targetCheckResults = document.getElementById("target-check-results");
    targetCheckResults.innerHTML = "";
    new uPlot(opts, data, targetCheckResults);
  }

  async update(id) {
    const authStoreHandler = new AuthStoreHandler();
    const sessionToken = await authStoreHandler.getSessionToken();

    if (sessionToken === "") {
      return;
    }

    const response = await fetch(`${targetsEndpoint}${id}/`, {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    });

    const target = await response.json();

    const header = this.element.querySelector("header");
    const spans = this.element.querySelectorAll("span");
    const deleteButton = this.element.querySelector("button");

    header.textContent = target.name;
    spans[0].textContent = target.url;
    spans[1].textContent = target.interval_seconds;
    deleteButton.dataset.id = id;

    this.updateIncidentsWidget(id, target.time_added);
    this.updateLatenciesWidget(id);
  }

  async set(data) {
    const id = data[0];
    await this.update(id);

    super.set(data);
  }
}

class TargetsView extends View {
  constructor() {
    super("targets", "Targets", /^\/targets\/?$/);
  }
}

class MainViewHandler {
  views = {
    target: new TargetView(),
    targets: new TargetsView(),
    "targets-add": new View(
      "targets-add",
      "Add a target",
      /^\/targets\/add\/?$/,
    ),
    profile: new View("profile", "Profile", /^\/profile\/?$/),
  };

  setView(name, pathname) {
    const view = this.views[name];

    const matches = view.pathnameRegex.exec(pathname);
    const data = matches.slice(1);

    view.set(data);
  }

  setViewFromURL() {
    const url = new URL(location.href);

    for (const view of Object.values(this.views)) {
      const matches = view.pathnameRegex.exec(url.pathname);
      if (matches !== null) {
        const data = matches.slice(1);
        view.set(data);
        break;
      }
    }

    this.views.targets.set([]);
  }

  addEventListeners() {
    document.body.addEventListener("click", (event) => {
      if (!event.target.matches(".view-button")) {
        return;
      }

      if (event.ctrlKey) {
        return;
      }

      event.preventDefault();

      const name = event.target.dataset.view;
      const pathname = event.target.pathname;
      this.setView(name, pathname);

      const url = new URL(location.href);
      url.pathname = event.target.pathname;
      history.pushState(name, "", url);
    });

    window.addEventListener("popstate", (event) => {
      if (event.state !== undefined && typeof event.state === "string") {
        const name = event.state;
        const pathname = event.target.document.location.pathname;
        this.setView(name, pathname);
      } else {
        this.setViewFromURL();
      }
    });
  }

  async init() {
    this.setViewFromURL();
    this.addEventListeners();

    for (const view of Object.values(this.views)) {
      view.init();
    }
  }
}

class StoreHandler {
  dbName = "reachard";
  version = 1;
  objectStores = ["auth"];

  async openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = (event) => {
        reject(event.target.error.message);
      };

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        for (const store of this.objectStores) {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store);
          }
        }
      };
    });
  }
}

class AuthStoreHandler {
  storeName = "auth";
  sessionTokenKey = "sessionToken";
  storeHandler = new StoreHandler();

  async putSessionToken(sessionToken) {
    const db = await this.storeHandler.openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.put(sessionToken, this.sessionTokenKey);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = (event) => {
        reject(event.target.error.message);
      };
    });
  }

  async getSessionToken() {
    const db = await this.storeHandler.openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, "readonly");
      const store = transaction.objectStore(this.storeName);
      const request = store.get(this.sessionTokenKey);

      request.onsuccess = (event) => {
        const value = event.target.result;
        if (value !== undefined && typeof value === "string") {
          resolve(value);
        } else {
          resolve("");
        }
      };

      request.onerror = (event) => {
        reject(event.target.error.message);
      };
    });
  }

  async deleteSessionToken() {
    const db = await this.storeHandler.openDatabase();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, "readwrite");
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(this.sessionTokenKey);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = (event) => {
        reject(event.target.error.message);
      };
    });
  }
}

export class SessionHandler {
  elements = {
    "ref-profile-logged-out": document.getElementById("ref-profile-logged-out"),
    "ref-profile-logged-in": document.getElementById("ref-profile-logged-in"),
  };

  async checkLoginStatus() {
    const authStoreHandler = new AuthStoreHandler();
    const sessionToken = await authStoreHandler.getSessionToken();

    if (sessionToken !== "") {
      this.elements["ref-profile-logged-in"].checked = true;
    } else {
      this.elements["ref-profile-logged-out"].checked = true;
    }
  }

  async init() {
    const sessionLogInForm = document.getElementById("session-log-in-form");
    sessionLogInForm.addEventListener("submit", (event) => this.logIn(event));

    const sessionLogOutButton = document.getElementById(
      "session-log-out-button",
    );
    sessionLogOutButton.addEventListener("click", (event) =>
      this.logOut(event),
    );

    this.checkLoginStatus();
  }

  async logIn(event) {
    event.preventDefault();

    const form = event.target;

    const requestObject = {
      username: form.username.value,
      password: form.password.value,
    };
    const json = JSON.stringify(requestObject);

    const response = await fetch(sessionEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: json,
    });

    const contentType = response.headers.get("Content-Type");
    if (contentType != "application/json") {
      console.error("The response `Content-Type` for targets is not JSON.");
      return;
    }

    let responseObject;
    try {
      responseObject = await response.json();
    } catch (err) {
      console.error("Failed to parse the session token as JSON:", err);
      return;
    }

    if (typeof responseObject !== "string") {
      console.error("The session token is not a JSON string.");
      return;
    }

    const sessionToken = responseObject;

    const authStoreHandler = new AuthStoreHandler();
    authStoreHandler.putSessionToken(sessionToken);
    this.checkLoginStatus();
  }

  async logOut() {
    const authStoreHandler = new AuthStoreHandler();
    const sessionToken = await authStoreHandler.getSessionToken();

    if (sessionToken === "") {
      return;
    }

    fetch(sessionEndpoint, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    });

    await authStoreHandler.deleteSessionToken();
    this.checkLoginStatus();
  }
}

export class TargetsHandler {
  elements = {
    targetsTableBody: document.getElementById("targets-table-body"),
    targetsTableRowTemplate: document.getElementById(
      "targets-table-row-template",
    ),
  };

  async init() {
    const targetsListButton = document.getElementById("targets-list-button");
    targetsListButton.addEventListener("click", (event) =>
      this.listTargets(event),
    );

    const targetsAddForm = document.getElementById("targets-add-form");
    targetsAddForm.addEventListener("submit", (event) =>
      this.postTarget(event),
    );
  }

  async listTargets() {
    const authStoreHandler = new AuthStoreHandler();
    const sessionToken = await authStoreHandler.getSessionToken();

    if (sessionToken === "") {
      return;
    }

    const response = await fetch(targetsEndpoint, {
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    });

    const contentType = response.headers.get("Content-Type");
    if (contentType != "application/json") {
      console.error("The response `Content-Type` for targets is not JSON.");
      return;
    }

    let responseObject;
    try {
      responseObject = await response.json();
    } catch (err) {
      console.error("Failed to parse the targets as JSON:", err);
      return;
    }

    if (!Array.isArray(responseObject)) {
      console.error("The list of targets is not a JSON array.");
      return;
    }

    const targets = responseObject;

    this.elements.targetsTableBody.innerHTML = "";

    if (targets.length === 0) {
      return;
    }

    for (const target of targets) {
      const template = this.elements.targetsTableRowTemplate;
      const row = template.content.cloneNode(true);
      let td = row.querySelectorAll("td");

      let a = td[0].querySelector("a");
      a.href = `/target/${target.id}`;
      a.textContent = target.name;

      td[1].textContent = target.url;
      td[2].textContent = target.interval_seconds;

      this.elements.targetsTableBody.appendChild(row);
    }
  }

  async postTarget(event) {
    event.preventDefault();

    const authStoreHandler = new AuthStoreHandler();
    const sessionToken = await authStoreHandler.getSessionToken();

    if (sessionToken === "") {
      return;
    }

    const form = event.target;

    const object = {
      name: form.name.value,
      url: form.url.value,
      interval_seconds: form.interval_seconds.valueAsNumber,
    };
    const json = JSON.stringify(object);

    await fetch(targetsEndpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sessionToken}`,
        "Content-Type": "application/json",
      },
      body: json,
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const mainViewHandler = new MainViewHandler();
  mainViewHandler.init();

  const sessionHandler = new SessionHandler();
  sessionHandler.init();

  const targetsHandler = new TargetsHandler();
  targetsHandler.init();
});
