import "./index.css";
import { Composition } from "remotion";
import { MyVideo } from "./MyVideo";
import { ClipsMontage } from "./scenes/ClipsMontage";
import {
  ClipsMontagePropsSchema,
  calculateClipsMontageMetadata,
} from "../lib/remotion-schema";
import { getDefaultClipsMontageProps } from "./defaultClipsMontageProps";

const FPS = 24;
const WIDTH = 1080;
const HEIGHT = 1920;
const DURATION_IN_FRAMES = 1430;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MyVideo"
        component={MyVideo}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
      />
      <Composition
        id="ClipsMontage"
        component={ClipsMontage}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        schema={ClipsMontagePropsSchema}
        defaultProps={getDefaultClipsMontageProps()}
        calculateMetadata={({ props }) =>
          calculateClipsMontageMetadata(props, FPS)
        }
      />
    </>
  );
};
