import * as React from "react";
import { Link as TSRLink } from "@tanstack/react-router";

type Props = React.ComponentProps<typeof TSRLink> & { href?: string };

export default function Link({ href, to, children, ...rest }: Props) {
  const target = (to ?? href ?? "/") as any;
  return (
    <TSRLink to={target} {...(rest as any)}>
      {children}
    </TSRLink>
  );
}

