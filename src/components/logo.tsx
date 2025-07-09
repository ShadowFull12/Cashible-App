import * as React from "react";
import Image from "next/image";

export function Logo(props: { className?: string }) {
  return (
    <Image 
      src="https://i.postimg.cc/ZqxtCkPY/PNGLogo.png" 
      alt="Cashible Logo" 
      width={64} 
      height={64} 
      className={props.className}
      priority 
    />
  );
}
