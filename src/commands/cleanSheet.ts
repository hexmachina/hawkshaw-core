import { Command } from "commander";
import { ExportUtil } from "../utils/exportUtil";
import { SchemaUtil } from "../utils/schemaUtil";

export function CleanSheetCommand(): Command {
  const command = new Command("clean-sheet");
  command
    .argument("<file>", "CSV file to import from")
    .action(async (file: string) => {
      const [routeMap, avj] = await SchemaUtil.LoadSchemas({
        useDefaults: true,
        removeAdditional: "all",
      });
      const def = require("ajv-keywords/dist/definitions/dynamicDefaults");
      def.DEFAULTS.customRandomInt = SchemaUtil.GetCustomRandomInt;
      const options = {};
      def.DEFAULTS.keyGen = (args: any) => SchemaUtil.GetKeyGen(args, options);
      const result = ExportUtil.LoadCSV(file);
      const edits = SchemaUtil.CleanEditContainers(
        avj,
        result,
        options,
        routeMap
      );
      await ExportUtil.ExportCSV(file, edits);
    });
  return command;
}
