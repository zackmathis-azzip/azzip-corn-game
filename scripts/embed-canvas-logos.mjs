import fs from "fs";

const azzipPath =
  "C:/Users/Zack/.cursor/projects/c-Users-Zack-OneDrive-Documents-Projects-Corn-Game/assets/c__Users_Zack_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_Azzip_Pizza__2-Color_-82087467-5668-4d3e-92ee-32b96e1d472a.png";
const omPath =
  "C:/Users/Zack/OneDrive/Documents/Projects/Corn Game/public/sponsors/old-major-transparent.png";
const outPath =
  "C:/Users/Zack/.cursor/projects/c-Users-Zack-OneDrive-Documents-Projects-Corn-Game/canvases/_logo-constants.txt";

const azzip = fs.readFileSync(azzipPath);
const om = fs.readFileSync(omPath);

const lines = [
  `const AZZIP_LOGO = "data:image/png;base64,${azzip.toString("base64")}";`,
  `const OLD_MAJOR_LOGO = "data:image/png;base64,${om.toString("base64")}";`,
  "",
];

fs.writeFileSync(outPath, lines.join("\n"));
console.log("azzip bytes:", azzip.length, "oldMajor bytes:", om.length, "out chars:", lines.join("\n").length);
