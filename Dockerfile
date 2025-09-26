# Copyright 2025 Pavel Sobolev
#
# This file is part of the Reachard project, located at
#
#     https://reachard.paveloom.dev
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
#
# SPDX-License-Identifier: Apache-2.0

FROM docker.io/nginx:1-alpine-slim AS builder

WORKDIR /build

RUN apk --no-cache add minify zola

ARG BASE_URL

RUN --mount=type=bind,source=.,target=src \
    zola -r src build ${BASE_URL:+-u "$BASE_URL"} -o output; \
    minify -rav -o . output

FROM docker.io/nginx:1-alpine-slim

COPY docker/default.conf /etc/nginx/conf.d/default.conf

COPY --from=builder /build/output /usr/share/nginx/html
