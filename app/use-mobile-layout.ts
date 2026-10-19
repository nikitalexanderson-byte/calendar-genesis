"use client";
import {useSyncExternalStore} from "react";

const query=()=>window.matchMedia("(max-width: 767px)");
const subscribe=(listener:()=>void)=>{const media=query();media.addEventListener("change",listener);return()=>media.removeEventListener("change",listener);};
const snapshot=()=>query().matches;
const serverSnapshot=()=>false;

export const useMobileLayout=()=>useSyncExternalStore(subscribe,snapshot,serverSnapshot);
