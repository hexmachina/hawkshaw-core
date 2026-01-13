import { Command } from "commander";
import { SchemaUtil } from "../utils/schemaUtil";
import { ExportUtil } from "../utils/exportUtil";

export function ImportSheetCommand(): Command {
  const command = new Command("import-sheet");
  command
    .argument("<file>", "CSV file to import from")
    .action(async (file: string) => {
      const [routeMap, avj] = await SchemaUtil.LoadSchemas({
        useDefaults: true,
        removeAdditional: true,
      });
      const def = require("ajv-keywords/dist/definitions/dynamicDefaults");
      def.DEFAULTS.customRandomInt = SchemaUtil.GetCustomRandomInt;
      const options = {};
      def.DEFAULTS.keyGen = (args: any) => SchemaUtil.GetKeyGen(args, options);
      const result = ExportUtil.LoadCSV(file);
      const sheetEdits = SchemaUtil.CleanEditContainers(
        avj,
        result,
        options,
        routeMap
      );
      const jsonEdits = await SchemaUtil.GetEditContainers(routeMap.values());
      const diff = SchemaUtil.CompareEditContainers(jsonEdits, sheetEdits);
      if (diff.length == 0) {
        return;
      }
      const promises: Promise<any>[] = [];
      for (const edit of diff) {
        const promise = SchemaUtil.WriteEditContainer(edit, true);
        if (promise) {
          promises.push(promise);
        }
      }
      await Promise.all(promises);
    });
  return command;
}
