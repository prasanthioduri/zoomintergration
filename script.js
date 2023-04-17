const VideoSDK = window.WebVideoSDK.default;

const VideoQuality = window.WebVideoSDK.default;
const client = VideoSDK.createClient();
//resource url was preloaded but not used within firsst few seconds make sure it has an appropiated 'as' value and it is preloaded intentionally
//A preload for 'https://source.zoom.us/videosdk/1.7.0/lib/js_media.min.js' is found, but is not used because the request credentials mode does not match. Consider taking a look at crossorigin attribute.
//ScriptProcessorNode is deprecated, use AudioWorklet instead
client.init("en-US", "CDN");
let stream;

function generateSessionToken(
  sdkKey,
  sdkSecret,
  topic,
  passWord = "",
  sessionKey = "",
  userIdentity = "",
  roleType = 1
) {
  let signature = "";
  try {
    const iat = Math.round(new Date().getTime() / 1000);
    const exp = iat + 60 * 60 * 2;

    const oHeader = { alg: "HS256", typ: "JWT" };
    const oPayload = {
      app_key: sdkKey,
      iat,
      exp,
      tpc: topic,
      pwd: passWord,
      user_identity: userIdentity,
      session_key: sessionKey,
      role_type: roleType,
    };

    const sHeader = JSON.stringify(oHeader);
    const sPayload = JSON.stringify(oPayload);
    signature = KJUR.jws.JWS.sign("HS256", sHeader, sPayload, sdkSecret);
  } catch (e) {
    console.error(e);
  }
  return signature;
}
//Mangle this lines into working code
function isSupportWebCodecs() {
  return typeof MediaStreamTrackProcessor === "function";
}
function isAndroidBrowser() {
  return /android/i.test(navigator.userAgent);
}
function isSupportOffscreenCanvas() {
  return typeof OffscreenCanvas === "function";
}

const PREVIEW_VIDEO_ELEMENT = document.getElementById("js-preview-video");

const PREVIEW_VIDEO_DIMS = {
  Width: 800,
  Height: 450,
};
const VIDEO_CANVAS = document.getElementById("video-canvas");
const SELF_VIDEO_ELEMENT = document.getElementById("self-video");
const SELF_VIDEO_CANVAS = document.getElementById("self-video-canvas");
const VIDEO_CANVAS_DIMS = {
  Width: 1280,
  Height: 800,
};

class SimpleState {
  constructor() {
    this.reset();
  }
  reset() {
    this.selfId = -1;
    this.participants = [];
    this.audioEncode = false;
    this.audioDecode = false;
    this.isStartedAudio = false;
  }
  resetParticipantId() {
    this.participants = [];
  }
}
new SimpleState();
const state = new SimpleState();

let prevIsSelfVideoOn = false;
let prevIsParticipantVideoOn = false;

/*
 * Dimensions and offset need to be carefully set to render multiple streams on a
 * single canvas. There are several things to keep in mind:
 *      1) Maintaining 16:9 aspect ratio (or whatever most participants have)
 *      2) Setting suitable height/width based on the render canvas dimensions
 *      3) Setting the correct offset
 *
 * For this demo, we have a simple example with only two video streams:
 * |------------------------------------------------------------------|
 * |                                |                                 |
 * |                                |                                 |
 * |          Participant           |              Self               |
 * |                                |                                 |
 * |                                |                                 |
 * |                                |                                 |
 * |------------------------------------------------------------------|
 *
 * To achieve the above, the participant stream is rendered with no offset and a
 * width equal to `canvas_width / 2`. For height, while we would typically need
 * to handle aspect ratio and vertical centering ourselves, the V-SDK automatically
 * handles it -- so just pass the canvas height
 *
 * We do the exact same for the self stream, but now have an x-offset of
 * `cavas_width / 2`
 *
 * This simple example can be extended to larger numbers (3, 4, etc.) and
 * dynamically adjusted based on the active number of participants!
 */

const toggleSelfVideo = async (mediaStream, isVideoOn) => {
  const isUsingVideoElementToStartVideo =
    typeof window.OffscreenCanvas === "function" &&
    !mediaStream.isSupportMultipleVideos();
  const isRenderingSingleVideoOnCanvas =
    typeof window.OffscreenCanvas !== "function" &&
    !mediaStream.isSupportMultipleVideos();

  if (typeof isVideoOn !== "boolean" || prevIsSelfVideoOn === isVideoOn) {
    return;
  }
  const canvas = isRenderingSingleVideoOnCanvas
    ? SELF_VIDEO_CANVAS
    : VIDEO_CANVAS;

  if (isVideoOn) {
    console.log("in is video on");
    if (isUsingVideoElementToStartVideo) {
      //  console.log('in isUsingVideoElementToStartVideon')

      SELF_VIDEO_ELEMENT.style.display = "block";
      SELF_VIDEO_ELEMENT.style.width = "50%";
      SELF_VIDEO_ELEMENT.style.left = "50%";
      await mediaStream.startVideo({ videoElement: SELF_VIDEO_ELEMENT });
    } else {
      await mediaStream.startVideo();
      if (isRenderingSingleVideoOnCanvas) {
        console.log("in else");
        SELF_VIDEO_CANVAS.style.display = "block";
        SELF_VIDEO_CANVAS.style.width = "50%";
        SELF_VIDEO_CANVAS.style.height = "50%";
        SELF_VIDEO_CANVAS.style.left = "50%";
        SELF_VIDEO_CANVAS.style.top = "50%";
        SELF_VIDEO_CANVAS.style.transform = "translateY(-50%)";
        await mediaStream.renderVideo(
          canvas,
          state.selfId,
          VIDEO_CANVAS_DIMS.Width / 2,
          VIDEO_CANVAS_DIMS.Height / 2,
          0,
          0,
          VideoQuality.Video_360P
        );
      } else {
        toggleParticipantVideo(mediaStream, state.userId, true);

        /* console.log('test')

		  await mediaStream.renderVideo(
          canvas,
          state.selfId,
          VIDEO_CANVAS_DIMS.Width / 2,
          VIDEO_CANVAS_DIMS.Height,
          VIDEO_CANVAS_DIMS.Width / 2,
          0,
          VideoQuality.Video_360P
        );*/
      }
    }
  } else {
    await mediaStream.stopVideo();
    if (!isUsingVideoElementToStartVideo) {
      if (isRenderingSingleVideoOnCanvas) {
        SELF_VIDEO_CANVAS.style.display = "none";
      }
      await mediaStream.stopRenderVideo(canvas, state.selfId);
    } else {
      SELF_VIDEO_ELEMENT.style.display = "none";
    }
  }
  prevIsSelfVideoOn = isVideoOn;
};
const screenWidth = 1280;
const screenHeight = 540;

const toggleParticipantVideo = async (mediaStream, userId, isVideoOn) => {
  /*if (typeof isVideoOn !== 'boolean' || prevIsParticipantVideoOn === isVideoOn) {
    return;
  }*/
  let peerParticipants1 = state.participants.filter(
    (user) => user.userId !== state.selfId
  );

  //let  peerParticipants1 = state.participants;

  let selfuser = state.participants.filter(
    (user) => user.userId === state.selfId
  );
  //	console.log('in else 3 selfuser--->' +selfuser[0].userId)

  //console.log(peerParticipants1)

  const n = peerParticipants1.length; // Replace with the desired number of rectangles
  const a = divideScreen(screenWidth, screenHeight, n);

  // VIDEO_CANVAS.style.display = 'none';
  //VIDEO_CANVAS.style.display = 'block';

  for (var i = 0; i < peerParticipants1.length; i++) {
    // console.log("user id--->"+peerParticipants1[i].userId)

    if (selfuser[0].bVideoOn) {
      console.log("self id--->" + selfuser[0].userId);
      var width1 = a[i][2] - a[i][0];
      var height1 = a[i][3] - a[i][1];
      var x1 = a[i][0];
      var y1 = a[i][1];
      console.log(i, width1, height1, x1, y1);
      await mediaStream.renderVideo(
        VIDEO_CANVAS,
        selfuser[0].userId,
        width1,
        height1,
        x1 + 40,
        y1 + 40,
        3
      );
    }

    if (peerParticipants1[i].bVideoOn) {
      var width = a[i][2] - a[i][0];
      var height = a[i][3] - a[i][1];
      var x = a[i][0];
      var y = a[i][1];
      console.log(i, width, height, x, y);
      await mediaStream.renderVideo(
        VIDEO_CANVAS,
        peerParticipants1[i].userId,
        width,
        height,
        x + 40,
        y + 40,
        3
      );
    } else {
      await mediaStream.stopRenderVideo(
        VIDEO_CANVAS,
        peerParticipants1[i].userId
      );
    }
    // prevIsParticipantVideoOn = isVideoOn;
  }
};

/**
 * Initializes the mic and webcam toggle buttons
 *
 * @param {VideoClient} zoomClient
 * @param {Stream} mediaStream
 */
const initButtonClickHandlers = async (zoomClient, mediaStream) => {
  const initMicClick = () => {
    const micButton = document.getElementById("js-mic-button");
    const micIcon = document.getElementById("js-mic-icon");

    let isMuted = true;
    let isButtonAlreadyClicked = false;
    if (!state.isStartedAudio) {
      micIcon.classList.remove("fa-microphone-slash");
      micIcon.classList.add("fa-headset");
    }

    const toggleMicButtonStyle = () => {
      micIcon.classList.toggle("fa-microphone");
      micIcon.classList.toggle("fa-microphone-slash");
      micButton.classList.toggle("meeting-control-button__off");
    };

    const toggleMuteUnmute = () =>
      isMuted ? mediaStream.muteAudio() : mediaStream.unmuteAudio();

    const isMutedSanityCheck = () => {
      const mediaStreamIsMuted = mediaStream.isAudioMuted();
      console.log("Sanity check: is muted? ", mediaStreamIsMuted);
      console.log(
        "Does this match button state? ",
        mediaStreamIsMuted === isMuted
      );
    };

    const onClick = async (event) => {
      event.preventDefault();
      if (!isButtonAlreadyClicked) {
        // Blocks logic from executing again if already in progress
        isButtonAlreadyClicked = true;
        if (state.isStartedAudio) {
          try {
            isMuted = !isMuted;
            await toggleMuteUnmute();
            toggleMicButtonStyle();
            isMutedSanityCheck();
          } catch (e) {
            console.error("Error toggling mute", e);
          }

          isButtonAlreadyClicked = false;
        } else {
          try {
            if (state.audioDecode && state.audioEncode) {
              await mediaStream.startAudio();
              micIcon.classList.remove("fa-headset");
              if (mediaStream.isAudioMuted()) {
                micIcon.classList.add("fa-microphone-slash");
                isMuted = true;
              } else {
                micIcon.classList.add("fa-microphone");
                isMuted = false;
              }
              state.isStartedAudio = true;
              isButtonAlreadyClicked = false;
            } else {
              console.warn("Please wait until media workers are ready");
            }
          } catch (e) {
            console.error("Error start audio", e);
          }
        }
      } else {
        console.log("=== WARNING: already toggling mic ===");
      }
    };

    micButton.addEventListener("click", onClick);
  };

  // Once webcam is started, the client will receive an event notifying that a video has started
  // At that point, video should be rendered. The reverse is true for stopping video
  const initWebcamClick = () => {
    const webcamButton = document.getElementById("js-webcam-button");

    let isWebcamOn = false;
    let isButtonAlreadyClicked = false;

    const toggleWebcamButtonStyle = () =>
      webcamButton.classList.toggle("meeting-control-button__off");

    const onClick = async (event) => {
      event.preventDefault();
      if (!isButtonAlreadyClicked) {
        // Blocks logic from executing again if already in progress
        isButtonAlreadyClicked = true;

        try {
          isWebcamOn = !isWebcamOn;
          await toggleSelfVideo(mediaStream, isWebcamOn);
          toggleWebcamButtonStyle();
        } catch (e) {
          isWebcamOn = !isWebcamOn;
          console.error("Error toggling video", e);
        }

        isButtonAlreadyClicked = false;
      } else {
        console.log("=== WARNING: already toggling webcam ===");
      }
    };

    webcamButton.addEventListener("click", onClick);
  };

  const initLeaveSessionClick = () => {
    const leaveButton = document.getElementById("js-leave-button");

    const onClick = async (event) => {
      event.preventDefault();
      try {
        await Promise.all([
          toggleSelfVideo(mediaStream, false),
          toggleParticipantVideo(mediaStream, false),
        ]);
        await zoomClient.leave();
        switchSessionToEndingView();
      } catch (e) {
        console.error("Error leaving session", e);
      }
    };

    leaveButton.addEventListener("click", onClick);
  };
  /* share screen */
  const initShareButton = () => {
    const sharebutton = document.getElementById("js-share-button");
    const shareOffbutton = document.getElementById("js-share-off-button");
    // const sharebuttonicon = document.getElementById("js-share-session-icon");
    const onClick = async (event) => {
      console.log("button shared");
      if (mediaStream.isStartShareScreenWithVideoElement()) {
        mediaStream
          .startShareScreen(document.querySelector("#self-video"))
          .then(() => {
            // show HTML Video element in DOM
            document.querySelector("#self-video").style.display = "block";
            sharebutton.style.display = "none";
            shareOffbutton.style.display = "block";
          })
          .catch((error) => {
            console.log(error);
          });
      } else {
        mediaStream
          .startShareScreen(document.querySelector("#self-video-canvas"))
          .then(() => {
            // show HTML Canvas element in DOM
            document.querySelector("#self-video-canvas").style.display =
              "block";
            sharebutton.style.display = "none";
            shareOffbutton.style.display = "block";
          })
          .catch((error) => {
            console.log(error);
          });
      }
    };
    sharebutton.addEventListener("click", onClick);
  };
  // off share screen
  const screenShareOff = () => {
    const sharebutton = document.getElementById("js-share-button");
    const shareOffbutton = document.getElementById("js-share-off-button");
    const onClick = async (event) => {
      mediaStream.stopShareScreen();
      sharebutton.style.display = "block";
      shareOffbutton.style.display = "none";
    };
    shareOffbutton.addEventListener("click", onClick);
  };
  client.on("passively-stop-share", (payload) => {
    const sharebutton = document.getElementById("js-share-button");
    const shareOffbutton = document.getElementById("js-share-off-button");
    if (payload["reason"] == "StopScreenCapture") {
      sharebutton.style.display = "block";
      shareOffbutton.style.display = "none";
    }
  });
  //participant screen view
  client.on("active-share-change", (payload) => {
    console.log("client,participent", payload.state);
    if (payload.state === "Active") {
      mediaStream.startShareView(
        document.querySelector("#video-canvas"),
        payload.userId
      );
      document.querySelector("#video-canvas").style.display = "block";
    } else if (payload.state === "Inactive") {
      mediaStream.stopShareView();
    }
  });
  initMicClick();
  initWebcamClick();
  initLeaveSessionClick();
  initShareButton();
  screenShareOff();
};

const PARTICIPANT_CHANGE_TYPE = {
  ADD: "add",
  REMOVE: "remove",
  UPDATE: "update",
};

const PEER_VIDEO_STATE_CHANGE_ACTION_TYPE = {
  Start: "Start",
  Stop: "Stop",
};

const onUserAddedListener = (zoomClient) => {
  zoomClient.on("user-added", (payload) => {
    console.log(`User added`, payload);

    state.participants = zoomClient.getAllUser();
  });
};

const onUserRemovedListener = (zoomClient) => {
  zoomClient.on("user-removed", (payload) => {
    console.log(`User removed`, payload);

    state.participants = zoomClient.getAllUser();
  });
};

const onUserUpdatedListener = (zoomClient) => {
  zoomClient.on("user-updated", (payload) => {
    console.log(`User updated`, payload);

    state.participants = zoomClient.getAllUser();
  });
};

const onPeerVideoStateChangedListener = (zoomClient, mediaStream) => {
  zoomClient.on("peer-video-state-change", async (payload) => {
    console.log("onPeerVideoStateChange", payload);
    const { action, userId } = payload;

    if (state.participants.findIndex((user) => user.userId === userId) === -1) {
      console.log("Detected unrecognized participant ID. Ignoring: ", userId);
      return;
    }
    if (action === PEER_VIDEO_STATE_CHANGE_ACTION_TYPE.Start) {
      toggleParticipantVideo(mediaStream, userId, true);
    } else if (action === PEER_VIDEO_STATE_CHANGE_ACTION_TYPE.Stop) {
      toggleParticipantVideo(mediaStream, userId, false);
    }
  });
};

const onMediaWorkerReadyListener = (zoomClient) => {
  zoomClient.on("media-sdk-change", (payload) => {
    const { action, type, result } = payload;
    if (type === "audio" && result === "success") {
      if (action === "encode") {
        state.audioEncode = true;
      } else if (action === "decode") {
        state.audioDecode = true;
      }
    }
  });
};

const initClientEventListeners = (zoomClient, mediaStream) => {
  onUserAddedListener(zoomClient, mediaStream);
  onUserRemovedListener(zoomClient, mediaStream);
  onUserUpdatedListener(zoomClient, mediaStream);
  onPeerVideoStateChangedListener(zoomClient, mediaStream);
  onMediaWorkerReadyListener(zoomClient);
  // The started video before join the session
  setTimeout(() => {
    const peerParticipants = state.participants.filter(
      (user) => user.userId !== state.selfId
    );
    for (let i = 0; i < peerParticipants.length; i++) {
      //alert(peerParticipants[i].displayName);
      if (
        peerParticipants.length > 0 &&
        peerParticipants[i].bVideoOn === true
      ) {
        toggleParticipantVideo(mediaStream, peerParticipants[i].userId, true);
      }
    }
  }, 3000);
};

const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
/**
 * Creates a zoom video client, and uses it to join/start a video session. It:
 *      1) Creates a zoom client
 *      2) Initializes the zoom client
 *      3) Tries to join a session, grabbing its Stream once successful
 *      4) Initializes the zoom client's important "on" event listeners
 *          - Very important, as failing to do so ASAP can miss important updates
 *      5) Joins the audio stream on mute
 */
const joinSession = async (zmClient) => {
  // const videoSDKLibDir = '/lib';
  const zmClientInitParams = {
    language: "en-US",
    // dependentAssets: `${window.location.origin}${videoSDKLibDir}`
  };
  const sessionToken = generateSessionToken(
    sdkKey,
    sdkSecret,
    topic,
    password,
    sessionKey
  );

  let mediaStream;

  const initAndJoinSession = async () => {
    await zmClient.init(
      zmClientInitParams.language,
      zmClientInitParams.dependentAssets
    );

    try {
      await zmClient.join(topic, sessionToken, name, password);
      mediaStream = zmClient.getMediaStream();
      state.selfId = zmClient.getSessionInfo().userId;
    } catch (e) {
      console.error(e);
    }
  };

  const startAudioMuted = async () => {
    await mediaStream.startAudio();
    state.isStartedAudio = true;
    if (!mediaStream.isAudioMuted()) {
      mediaStream.muteAudio();
    }
  };

  const join = async () => {
    console.log("======= Initializing video session =======");
    await initAndJoinSession();
    /**
     * Note: it is STRONGLY recommended to initialize the client listeners as soon as
     * the session is initialized. Once the user joins the session, updates are sent to
     * the event listeners that help update the session's participant state.
     *
     * If you choose not to do so, you'll have to manually deal with race conditions.
     * You should be able to call "zmClient.getAllUser()" after the app has reached
     * steady state, meaning a sufficiently-long time
     */
    console.log("======= Initializing client event handlers =======");
    initClientEventListeners(zmClient, mediaStream);
    console.log("======= Starting audio muted =======");
    if (!isSafari) {
      await startAudioMuted();
    }

    console.log("======= Initializing button click handlers =======");
    await initButtonClickHandlers(zmClient, mediaStream);
    console.log("======= Session joined =======");
  };

  await join();
  return zmClient;
};
const initPreviewButtons = () => {
  VideoSDK.preloadDependentAssets();
  const zmClient = VideoSDK.createClient();
  const audioTrack = VideoSDK.createLocalAudioTrack();
  const videoTrack = VideoSDK.createLocalVideoTrack();
  let isPreviewAudioConnected = false;
  let isWebcamOn = false;
  const initPreviewAudioButtonClick = () => {
    const VOLUME_ANIMATION_INTERVAL_MS = 100;
    let volumeAnimation = null;
    let prevVolumeAnimationStyle = "";

    const micButton = document.getElementById("js-preview-mic-button");
    const micIcon = document.getElementById("js-preview-mic-icon");

    let isMuted = true;

    let isButtonAlreadyClicked = false;

    const toggleMicButtonStyle = () => {
      micIcon.classList.toggle("fa-microphone");
      micIcon.classList.toggle("fa-microphone-slash");
      micButton.classList.toggle("meeting-control-button__off");

      if (prevVolumeAnimationStyle) {
        micIcon.classList.toggle(prevVolumeAnimationStyle);
        prevVolumeAnimationStyle = "";
      }
    };

    const animateMicVolume = () => {
      const newVolume = audioTrack.getCurrentVolume();
      let newVolumeAnimationStyle = "";

      if (newVolume === 0) {
        newVolumeAnimationStyle = "";
      } else if (newVolume <= 0.1) {
        newVolumeAnimationStyle = "mic-feedback__very-low";
      } else if (newVolume <= 0.2) {
        newVolumeAnimationStyle = "mic-feedback__low";
      } else if (newVolume <= 0.3) {
        newVolumeAnimationStyle = "mic-feedback__medium";
      } else if (newVolume <= 0.4) {
        newVolumeAnimationStyle = "mic-feedback__high";
      } else if (newVolume <= 0.5) {
        newVolumeAnimationStyle = "mic-feedback__very-high";
      } else {
        newVolumeAnimationStyle = "mic-feedback__max";
      }

      if (prevVolumeAnimationStyle !== "") {
        micIcon.classList.toggle(prevVolumeAnimationStyle);
      }

      if (newVolumeAnimationStyle !== "") {
        micIcon.classList.toggle(newVolumeAnimationStyle);
      }
      prevVolumeAnimationStyle = newVolumeAnimationStyle;
    };

    const startVolumeAnimation = () => {
      if (!volumeAnimation) {
        volumeAnimation = setInterval(
          animateMicVolume,
          VOLUME_ANIMATION_INTERVAL_MS
        );
      }
    };

    const endVolumeAnimation = () => {
      if (volumeAnimation) {
        clearInterval(volumeAnimation);
        volumeAnimation = null;
      }
    };

    const toggleMuteUnmute = () => {
      if (isMuted) {
        audioTrack.mute();
        endVolumeAnimation();
      } else {
        audioTrack.unmute();
        startVolumeAnimation();
      }
    };

    const onClick = async (event) => {
      event.preventDefault();
      if (!isButtonAlreadyClicked) {
        // Blocks logic from executing again if already in progress
        isButtonAlreadyClicked = true;

        try {
          if (!isPreviewAudioConnected) {
            await audioTrack.start();
            isPreviewAudioConnected = true;
          }
          isMuted = !isMuted;
          await toggleMuteUnmute();
          toggleMicButtonStyle();
        } catch (e) {
          console.error("Error toggling mute", e);
        }

        isButtonAlreadyClicked = false;
      } else {
        console.log("=== WARNING: already toggling mic ===");
      }
    };

    micButton.addEventListener("click", onClick);
  };

  const initVideoPreviewButtonClick = () => {
    const webcamButton = document.getElementById("js-preview-webcam-button");

    let isButtonAlreadyClicked = false;

    const toggleWebcamButtonStyle = () =>
      webcamButton.classList.toggle("meeting-control-button__off");
    const togglePreviewVideo = async () =>
      isWebcamOn ? videoTrack.start(PREVIEW_VIDEO_ELEMENT) : videoTrack.stop();

    const onClick = async (event) => {
      event.preventDefault();
      if (!isButtonAlreadyClicked) {
        // Blocks logic from executing again if already in progress
        isButtonAlreadyClicked = true;

        try {
          isWebcamOn = !isWebcamOn;
          await togglePreviewVideo();
          toggleWebcamButtonStyle();
        } catch (e) {
          isWebcamOn = !isWebcamOn;
          console.error("Error toggling video preview", e);
        }

        isButtonAlreadyClicked = false;
      } else {
        console.log("=== WARNING: already toggling webcam ===");
      }
    };

    webcamButton.addEventListener("click", onClick);
  };

  const initJoinButtonClick = () => {
    const joinButton = document.getElementById("js-preview-join-button");
    let isButtonAlreadyClicked = false;

    const onClick = async (event) => {
      event.preventDefault();
      if (!isButtonAlreadyClicked) {
        // Blocks logic from executing again if already in progress
        isButtonAlreadyClicked = true;
        try {
          if (isPreviewAudioConnected) {
            audioTrack.stop();
            isPreviewAudioConnected = false;
          }
          if (isWebcamOn) {
            videoTrack.stop();
          }
          switchPreviewToLoadingView();
          await joinSession(zmClient);
          switchLoadingToSessionView();
        } catch (e) {
          console.error("Error joining session", e);
        }

        isButtonAlreadyClicked = false;
      } else {
        console.log("=== WARNING: already toggling webcam ===");
      }
    };

    joinButton.addEventListener("click", onClick);
  };

  initPreviewAudioButtonClick();
  initVideoPreviewButtonClick();
  initJoinButtonClick();
};
window.addEventListener("DOMContentLoaded", async () => {
  console.log("======= Initializing preview =======");
  await initPreviewButtons();
  console.log("======= Done initializing preview =======");
});
const Views = {
  Preview: document.getElementById("js-preview-view"),
  Loading: document.getElementById("js-loading-view"),
  Session: document.getElementById("js-video-view"),
  End: document.getElementById("js-end-view"),
};

const switchPreviewToLoadingView = () => {
  Views.Preview.classList.toggle("hidden");
  Views.Loading.classList.toggle("hidden");
};

const switchLoadingToSessionView = () => {
  Views.Loading.classList.toggle("hidden");
  Views.Session.classList.toggle("hidden");
};

const switchSessionToEndingView = () => {
  Views.Session.classList.toggle("hidden");
  Views.End.classList.toggle("hidden");
};
/**for splitting participans **/
function optimalFactors(n) {
  let factors = [];
  for (let i = 1; i <= Math.floor(Math.sqrt(n)); i++) {
    if (n % i === 0) {
      factors.push([i, n / i]);
    }
  }
  return factors.reduce((min, current) => {
    return Math.abs(min[0] - min[1]) < Math.abs(current[0] - current[1])
      ? min
      : current;
  });
}

function divideScreen(screenWidth, screenHeight, n) {
  const [rows, cols] = optimalFactors(n);
  const rectangleWidth = Math.floor(screenWidth / cols);
  const rectangleHeight = Math.floor(screenHeight / rows);

  let rectangles = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      let x1 = j * rectangleWidth;
      let y1 = i * rectangleHeight;
      let x2 = (j + 1) * rectangleWidth;
      let y2 = (i + 1) * rectangleHeight;
      let rectangle = [x1, y1, x2, y2];
      rectangles.push(rectangle);
    }
  }

  return rectangles;
}
