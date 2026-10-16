// El vídeo institucional del hospital es un enlace de YouTube o Vimeo que el
// hospital pega en el panel. Mismo parseo que losresis-panel
// (src/lib/videoInstitucional.ts): si cambia uno, cambia el otro.

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

const parseUrl = (value) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    return new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
};

const youtubeId = (url) => {
  const host = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");
  if (host === "youtu.be") {
    return url.pathname.split("/")[1] || null;
  }
  if (host !== "youtube.com" && host !== "youtube-nocookie.com") {
    return null;
  }
  if (url.pathname === "/watch") {
    return url.searchParams.get("v");
  }
  const [, kind, id] = url.pathname.split("/");
  return ["embed", "shorts", "live", "v"].includes(kind) ? id || null : null;
};

const vimeoId = (url) => {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  if (host !== "vimeo.com" && host !== "player.vimeo.com") {
    return null;
  }
  const numeric = url.pathname.split("/").filter((part) => /^\d+$/.test(part));
  return numeric.length > 0 ? numeric[numeric.length - 1] : null;
};

/**
 * @param {string|null|undefined} value
 * @returns {{provider: "youtube"|"vimeo", watchUrl: string, thumbnailUrl: string|null}|null}
 */
export const parseInstitutionalVideo = (value) => {
  const url = parseUrl(value);
  if (!url) return null;

  const yt = youtubeId(url);
  if (yt && YOUTUBE_ID.test(yt)) {
    return {
      provider: "youtube",
      watchUrl: `https://www.youtube.com/watch?v=${yt}`,
      thumbnailUrl: `https://img.youtube.com/vi/${yt}/hqdefault.jpg`,
    };
  }

  const vm = vimeoId(url);
  if (vm) {
    // Vimeo no expone la miniatura sin llamar a su API: se pinta un fondo liso.
    return { provider: "vimeo", watchUrl: `https://vimeo.com/${vm}`, thumbnailUrl: null };
  }

  return null;
};
