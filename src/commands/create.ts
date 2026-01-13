import { Command } from "commander";
import { SchemaUtil } from "../utils/schemaUtil";
import inquirer from "inquirer";

export function CreateCommand(): Command {
  const command = new Command("create");

  command.action(async () => {
    const [routeMap, ajv] = await SchemaUtil.LoadSchemas({
      useDefaults: true,
    });
    const def = require("ajv-keywords/dist/definitions/dynamicDefaults");
    def.DEFAULTS.customRandomInt = SchemaUtil.GetCustomRandomInt;
    def.DEFAULTS.keyGen = (args: any) => SchemaUtil.GetKeyGen(args);
    const schemaChoices = SchemaUtil.SchemaOptions(routeMap, ajv);
    const answers = await inquirer.prompt<{ schema: string; title: string }>([
      {
        type: "select",
        name: "schema",
        message: "What is the entry type?",
        choices: schemaChoices,
      },
      {
        type: "input",
        name: "title",
        message: "What is the entry title? (e.g. The Maltese Falcon)",
      },
    ]);
    const files = await SchemaUtil.CreateEntryAndMeta(
      routeMap,
      ajv,
      answers.schema,
      answers.title
    );
    console.log(`Success! ${files.length} files written:`);
    for (const element of files) {
      console.log(element);
    }
  });

  return command;
}
