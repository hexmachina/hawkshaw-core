import { EditContainer } from "../types";

export class YarnGenerator {
  public static NodeWrapper(title: string, contents: string[]): string[] {
    if (!title || title.length == 0) {
      throw Error("Invalid args");
    }
    const wrapper: string[] = [
      YarnGenerator.CommentWrapper(`This file was automatically generated.`),
      YarnGenerator.CommentWrapper(`DO NOT MODIFY IT BY HAND.`),
      ``,
      `title: ${title}`,
      `---`,
    ];
    wrapper.push(...contents);
    wrapper.push(`===`);
    return wrapper;
  }
  public static BooleanVariableWrapper(variableName: string): string {
    return `<<declare $${variableName} = false>>`;
  }
  public static CommentWrapper(comment: string): string {
    return `/// ${comment}`;
  }

  public static ParseEntries(
    title: string,
    containers: EditContainer[]
  ): string[] {
    const contents: string[] = [];
    const regex = /\r\n|\r|\n/g;
    for (const element of containers) {
      if (element.meta) {
        if (element.meta.title) {
          contents.push(YarnGenerator.CommentWrapper(element.meta?.title));
        }
        if (element.meta.description) {
          const split = element.meta.description.split(regex);
          for (const clip of split) {
            contents.push(YarnGenerator.CommentWrapper(clip));
          }
        }
      }
      contents.push(YarnGenerator.BooleanVariableWrapper(element.data.key));
    }
    return YarnGenerator.NodeWrapper(title, contents);
  }
}
