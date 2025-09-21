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

const addr = "http://127.0.0.1:7272";
const sessionEndpoint = `${addr}/v0/session/`;
const targetsEndpoint = `${addr}/v0/targets/`;

class View {
  constructor(refName, title, pathnameRegex) {
    this.ref = document.getElementById(`ref-${refName}`);
    this.title = `${title} | Reachard`;
    this.pathnameRegex = pathnameRegex;
  }

  setView() {
    this.ref.checked = true;
    document.title = this.title;
  }
}

class MainViewHandler {
  views = {
    targets: new View("targets", "Targets", /^\/targets\/?$/),
    "targets-add": new View(
      "targets-add",
      "Add a target",
      /^\/targets\/add\/?$/,
    ),
    profile: new View("profile", "Profile", /^\/profile\/?$/),
  };

  setView(name) {
    if (!(name in this.views)) {
      return;
    }

    const view = this.views[name];
    view.setView();
  }

  setViewFromURL() {
    const url = new URL(location.href);

    for (const [name, view] of Object.entries(this.views)) {
      if (view.pathnameRegex.test(url.pathname)) {
        this.setView(name);
        break;
      }
    }
  }

  addEventListeners() {
    const viewButtons = document.getElementsByClassName("view-button");
    for (const viewButton of viewButtons) {
      viewButton.addEventListener("click", (event) => {
        event.preventDefault();

        const name = event.target.dataset.view;
        const view = this.views[name];

        const url = new URL(location.href);
        url.pathname = event.target.pathname;
        document.title = view.title;
        history.pushState(name, "", url);

        view.setView();
      });
    }

    window.addEventListener("popstate", (event) => {
      if (event.state !== undefined && typeof event.state === "string") {
        const name = event.state;
        this.setView(name);
      } else {
        this.setViewFromURL();
      }
    });
  }

  async init() {
    this.setViewFromURL();
    this.addEventListeners();
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

    const targetsDeleteForm = document.getElementById("targets-delete-form");
    targetsDeleteForm.addEventListener("submit", (event) =>
      this.deleteTarget(event),
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

      td[0].textContent = target.name;
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

  async deleteTarget(event) {
    event.preventDefault();

    const authStoreHandler = new AuthStoreHandler();
    const sessionToken = await authStoreHandler.getSessionToken();

    if (sessionToken === "") {
      return;
    }

    const form = event.target;
    const json = JSON.stringify(form.id.valueAsNumber);

    await fetch(targetsEndpoint, {
      method: "DELETE",
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
