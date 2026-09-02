import fs from "fs";

const azzipPath =
  "C:/Users/Zack/.cursor/projects/c-Users-Zack-OneDrive-Documents-Projects-Corn-Game/assets/c__Users_Zack_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_Azzip_Pizza__2-Color_-82087467-5668-4d3e-92ee-32b96e1d472a.png";
const omPath =
  "C:/Users/Zack/OneDrive/Documents/Projects/Corn Game/public/sponsors/old-major-transparent.png";
const canvasPath =
  "C:/Users/Zack/.cursor/projects/c-Users-Zack-OneDrive-Documents-Projects-Corn-Game/canvases/corn-kernel-timeline.canvas.tsx";

const azzip = fs.readFileSync(azzipPath);
const om = fs.readFileSync(omPath);

const logoBlock = `const AZZIP_LOGO = "data:image/png;base64,${azzip.toString("base64")}";
const OLD_MAJOR_LOGO = "data:image/png;base64,${om.toString("base64")}";`;

const sponsorSvg = `      {/* Sponsor logos behind the kernels — revealed as the cob is picked clean */}
      <g opacity={reveal} aria-hidden="true">
        <image
          href={AZZIP_LOGO}
          x={VIEW_W * 0.24 - VIEW_W * 0.14}
          y={VIEW_H * 0.5 - VIEW_H * 0.29}
          width={VIEW_W * 0.28}
          height={VIEW_H * 0.58}
          opacity={0.26}
          preserveAspectRatio="xMidYMid meet"
        />
        <text
          x={VIEW_W * 0.5}
          y={VIEW_H * 0.53}
          textAnchor="middle"
          fontSize={VIEW_H * 0.12}
          fontWeight={600}
          fill={CORN.logo}
          opacity={0.38}
          fontFamily="system-ui, sans-serif"
        >
          ×
        </text>
        <image
          href={OLD_MAJOR_LOGO}
          x={VIEW_W * 0.76 - VIEW_W * 0.16}
          y={VIEW_H * 0.5 - VIEW_H * 0.29}
          width={VIEW_W * 0.32}
          height={VIEW_H * 0.58}
          opacity={0.36}
          preserveAspectRatio="xMidYMid meet"
        />
      </g>`;

let src = fs.readFileSync(canvasPath, "utf8");

if (!src.includes("const CORN = {")) {
  console.error("CORN block not found");
  process.exit(1);
}

if (src.includes("const AZZIP_LOGO =")) {
  src = src.replace(/const AZZIP_LOGO = "[^"]+";[\r\n]+const OLD_MAJOR_LOGO = "[^"]+";[\r\n]*/, logoBlock + "\n\n");
} else {
  src = src.replace("const CORN = {", logoBlock + "\n\nconst CORN = {");
}

const oldSponsorBlock = /      \{\/\* Sponsor logos behind the kernels[\s\S]*?      <\/g>\r?\n\r?\n      \{\/\* Husk leaves/;
if (!oldSponsorBlock.test(src)) {
  console.error("Sponsor block not found");
  process.exit(1);
}
src = src.replace(oldSponsorBlock, sponsorSvg + "\n\n      {/* Husk leaves");

fs.writeFileSync(canvasPath, src);
console.log("Patched canvas:", canvasPath);
console.log("azzip", azzip.length, "bytes, oldMajor", om.length, "bytes");
