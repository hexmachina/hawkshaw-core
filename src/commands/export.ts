import { Command } from "commander";
import { ExportUtil } from "../utils/exportUtil";

export function ExportCommand(): Command {
  const command = new Command("export");
  command
    .argument("<items...>", "export location")
    .requiredOption("-d, --dir <string>", "export location")
    .action(async (items: string[], options: { dir: string }) => {
      await ExportUtil.ExportByArgument(items, options.dir);
    });
  return command;
}
