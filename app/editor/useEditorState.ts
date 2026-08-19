"use client";

import { useReducer } from "react";
import { clampTrimRange, toRenderProps } from "../../lib/remotion-schema";
import type { Clip, ClipsMontageProps, TranscriptCaption } from "../../lib/remotion-schema";

export type { TransitionChoice } from "../../lib/remotion-schema";
// Reuses the exact same shape end-to-end - what the editor UI builds up is
// already a valid Clip, no separate "draft" type needed.
export type EditorClip = Clip;

export type EditorState = {
  clips: EditorClip[];
  transitionDurationInFrames: number;
};

const initialState: EditorState = {
  clips: [],
  transitionDurationInFrames: 12,
};

export type Action =
  | { type: "ADD_CLIP"; clip: EditorClip }
  | { type: "REMOVE_CLIP"; id: string }
  | { type: "MOVE_CLIP"; id: string; direction: "up" | "down" }
  | {
      type: "SET_TRIM";
      id: string;
      trimBeforeSeconds: number;
      trimAfterSeconds: number;
    }
  | {
      type: "SET_TRANSITION";
      id: string;
      transitionAfter: EditorClip["transitionAfter"];
    }
  | { type: "SET_CAPTION"; id: string; captionText: string }
  | { type: "SET_CAPTIONS"; id: string; captions: TranscriptCaption[] };

function reducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case "ADD_CLIP": {
      if (state.clips.some((clip) => clip.id === action.clip.id)) {
        return state;
      }
      return { ...state, clips: [...state.clips, action.clip] };
    }
    case "REMOVE_CLIP":
      return {
        ...state,
        clips: state.clips.filter((clip) => clip.id !== action.id),
      };
    case "MOVE_CLIP": {
      const index = state.clips.findIndex((clip) => clip.id === action.id);
      if (index === -1) {
        return state;
      }
      const swapWith = action.direction === "up" ? index - 1 : index + 1;
      if (swapWith < 0 || swapWith >= state.clips.length) {
        return state;
      }
      const clips = [...state.clips];
      [clips[index], clips[swapWith]] = [clips[swapWith], clips[index]];
      return { ...state, clips };
    }
    case "SET_TRIM":
      return {
        ...state,
        clips: state.clips.map((clip) =>
          clip.id === action.id
            ? {
                ...clip,
                ...clampTrimRange(
                  clip.sourceDurationSeconds,
                  action.trimBeforeSeconds,
                  action.trimAfterSeconds,
                ),
              }
            : clip,
        ),
      };
    case "SET_TRANSITION":
      return {
        ...state,
        clips: state.clips.map((clip) =>
          clip.id === action.id
            ? { ...clip, transitionAfter: action.transitionAfter }
            : clip,
        ),
      };
    case "SET_CAPTION":
      return {
        ...state,
        clips: state.clips.map((clip) =>
          clip.id === action.id
            ? { ...clip, captionText: action.captionText }
            : clip,
        ),
      };
    case "SET_CAPTIONS":
      return {
        ...state,
        clips: state.clips.map((clip) =>
          clip.id === action.id ? { ...clip, captions: action.captions } : clip,
        ),
      };
    default:
      return state;
  }
}

export function useEditorState() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const renderProps: ClipsMontageProps | null =
    state.clips.length > 0
      ? toRenderProps({
          clips: state.clips,
          transitionDurationInFrames: state.transitionDurationInFrames,
        })
      : null;

  return { state, dispatch, renderProps };
}
