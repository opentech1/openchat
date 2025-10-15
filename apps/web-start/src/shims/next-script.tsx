import * as React from "react";

export default function Script(props: { id?: string; children?: string; strategy?: string }) {
  return <script id={props.id} dangerouslySetInnerHTML={{ __html: props.children ?? "" }} />;
}

