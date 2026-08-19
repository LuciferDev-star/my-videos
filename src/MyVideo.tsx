import { ClipsMontage } from "./scenes/ClipsMontage";
import { getDefaultClipsMontageProps } from "./defaultClipsMontageProps";

export const MyVideo: React.FC = () => {
  return <ClipsMontage {...getDefaultClipsMontageProps()} />;
};
