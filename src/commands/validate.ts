import { Command } from "commander";
import { SchemaUtil } from "../utils/schemaUtil";

export function ValidateCommand(): Command {
  const command = new Command("validate");
  command.action(async () => {
    SchemaUtil.Validate();
  });
  return command;
}
