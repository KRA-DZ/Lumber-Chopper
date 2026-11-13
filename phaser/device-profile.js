// Screen width alone would incorrectly disable co-op in a narrow desktop window.
export const touchOnlyControls=()=>navigator.userAgentData?.mobile===true || (navigator.maxTouchPoints>0&&matchMedia('(pointer: coarse)').matches);
