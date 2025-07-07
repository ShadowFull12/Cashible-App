
import * as React from "react";
import Image from "next/image";

export function Logo(props: { className?: string }) {
  return (
    <Image 
      src="https://i.ibb.co/k3Pz2D5/logo.png" 
      alt="SpendWise Logo" 
      width={64} 
      height={64} 
      className={props.className}
      priority 
    />
  );
}
