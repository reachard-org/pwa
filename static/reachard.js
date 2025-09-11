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

const targets = document.getElementById("targets");

async function listTargets() {
  const response = await fetch(targetsEndpoint);

  let object;
  try {
    object = await response.json();
  } catch (err) {
    console.error("Failed to parse the targets as JSON:", err);
    return;
  }

  if (!Array.isArray(object)) {
    console.error("The list of targets is not a JSON array.");
    return;
  }

  targets.innerHTML = "";

  if (object.length === 0) {
    const child = document.createElement("p");
    child.innerHTML = "No targets.";
    targets.appendChild(child);

    return;
  }

  for (const row of object) {
    const child = document.createElement("p");
    child.innerHTML = JSON.stringify(row);
    targets.appendChild(child);
  }
}

async function postTarget(event) {
  event.preventDefault();

  const form = event.target;

  const object = {
    url: form.url.value,
    interval_seconds: form.interval_seconds.valueAsNumber,
  };
  const json = JSON.stringify(object);

  const response = await fetch(targetsEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: json,
  });
}

async function deleteTarget(event) {
  event.preventDefault();

  const form = event.target;

  const json = JSON.stringify(form.id.valueAsNumber);

  const response = await fetch(targetsEndpoint, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
    body: json,
  });
}

const listButton = document.getElementById("list-button");
listButton.addEventListener("click", listTargets);

const addForm = document.getElementById("add-form");
addForm.addEventListener("submit", postTarget);

const deleteForm = document.getElementById("delete-form");
deleteForm.addEventListener("submit", deleteTarget);
