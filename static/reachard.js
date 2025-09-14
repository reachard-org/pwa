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
const targetsEndpoint = `${addr}/v0/targets/`;

class TargetsHandler {
  constructor() {
    this.targetsList = document.getElementById("targets-list");
  }

  init() {
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
    const response = await fetch(targetsEndpoint);

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

    this.targetsList.innerHTML = "";

    if (targets.length === 0) {
      const child = document.createElement("p");
      child.innerHTML = "No targets.";
      this.targetsList.appendChild(child);

      return;
    }

    for (const target of targets) {
      const child = document.createElement("p");
      child.innerHTML = JSON.stringify(target);
      this.targetsList.appendChild(child);
    }
  }

  async postTarget(event) {
    event.preventDefault();

    const form = event.target;

    const object = {
      url: form.url.value,
      interval_seconds: form.interval_seconds.valueAsNumber,
    };
    const json = JSON.stringify(object);

    await fetch(targetsEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: json,
    });
  }

  async deleteTarget(event) {
    event.preventDefault();

    const form = event.target;

    const json = JSON.stringify(form.id.valueAsNumber);

    await fetch(targetsEndpoint, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: json,
    });
  }
}

const targetsHandler = new TargetsHandler();
targetsHandler.init();
