// SPDX-License-Identifier: Apache-2.0

declare namespace App {
  interface Locals {
    /** Set by src/routeData.ts on every docs page. */
    osVersion?: import('./versioning').OsVersion;
  }
}
