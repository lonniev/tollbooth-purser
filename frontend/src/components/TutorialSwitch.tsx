/** The "Live tutorial" switch: on, each page offers its walk once; off, none do. The mechanics are the package's. */

import { tourTarget, useTourSwitch } from "@tollbooth-dpyc/web/react";

export default function TutorialSwitch() {
  const tutorial = useTourSwitch();
  return (
    <label className="flex items-center gap-3" {...tourTarget("account.tutorial")}>
      <input type="checkbox" checked={tutorial.on} onChange={(e) => tutorial.setOn(e.target.checked)} className="h-5 w-5 accent-[var(--tb-accent)]" />
      <span className="text-sm">
        Live tutorial
        <span className="muted block text-xs">A short walk around each page the first time it sits quiet.</span>
      </span>
    </label>
  );
}
