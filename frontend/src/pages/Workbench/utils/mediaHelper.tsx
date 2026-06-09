import React from 'react';

/**
 * 判断 URL 是否为视频文件
 */
export function isVideoUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  return /\.(mp4|mov|avi|webm|mkv)(\?|$)/i.test(url);
}

/**
 * 根据文件类型渲染 <video> 或 <img>
 * 用于首帧、尾帧、参考图等可能包含视频的场景
 */
export function renderMediaPreview(
  url: string,
  props: {
    alt?: string;
    style?: React.CSSProperties;
    muted?: boolean;
    controls?: boolean;
  } = {}
) {
  const { alt = '', style = {}, muted = true, controls = false } = props;

  if (isVideoUrl(url)) {
    return (
      <video
        src={url}
        style={style}
        muted={muted}
        controls={controls}
      />
    );
  }

  return <img src={url} alt={alt} style={style} />;
}
