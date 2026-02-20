#!/usr/bin/env node
import { Command } from "commander";
import { CreateCommand } from "./commands/create";
import { ExportCommand } from "./commands/export";
import { ValidateCommand } from "./commands/validate";
import { ImportSheetCommand } from "./commands/importSheet";
import { CleanSheetCommand } from "./commands/cleanSheet";

export class Hawkshaw {}

module.exports = exports = Hawkshaw;
module.exports.Hawkshaw = Hawkshaw;
Object.defineProperty(exports, "__esModule", { value: true });

export default Hawkshaw;

export { FileUtil } from "./utils/fileUtil";
export { SchemaUtil } from "./utils/schemaUtil";
export { ExportUtil } from "./utils/exportUtil";

const program = new Command();

program
  .name("hawkshaw")
  .description("A sample CLI built with Node.js + TypeScript")
  .version("1.0.0");

program.addCommand(CreateCommand());
program.addCommand(ExportCommand());
program.addCommand(ValidateCommand());
program.addCommand(ImportSheetCommand());
program.addCommand(CleanSheetCommand());
// Parse CLI arguments
program.parse(process.argv);
