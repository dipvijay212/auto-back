import voiceService from '../services/voice.service.js';
import reelScriptService from '../services/reelScript.service.js';
import Caption from '../models/caption.model.js';
import VoiceScript from '../models/voiceScript.model.js';
import AudioAsset from '../models/audioAsset.model.js';
import AppError from '../utils/appError.js';

const catchAsync = (fn) => (req, res, next) => {
  fn(req, res, next).catch(next);
};

export const generateVoiceScript = catchAsync(async (req, res, next) => {
  const { captionId } = req.body;

  let captionDoc;
  if (captionId) {
    captionDoc = await Caption.findById(captionId);
  } else {
    captionDoc = await Caption.findOne().sort({ createdAt: -1 });
  }

  if (!captionDoc) {
    return next(new AppError('No Caption document found to generate voice script.', 404));
  }

  const scriptDoc = await reelScriptService.generateScriptFromCaption(captionDoc);

  res.status(200).json({
    success: true,
    scriptId: scriptDoc._id,
    scriptText: scriptDoc.scriptText,
    captionId: scriptDoc.captionId
  });
});

export const generateVoice = catchAsync(async (req, res, next) => {
  const { scriptId, voiceScriptId, script } = req.body;

  // Backwards compatibility fallback if a plain string script is sent
  if (script && !scriptId && !voiceScriptId) {
    const voicePath = await voiceService.generateSpeech(script);
    return res.status(200).json({ success: true, voicePath });
  }

  let voiceScriptDoc;
  const targetScriptId = scriptId || voiceScriptId;

  if (targetScriptId) {
    voiceScriptDoc = await VoiceScript.findById(targetScriptId);
  } else {
    voiceScriptDoc = await VoiceScript.findOne().sort({ createdAt: -1 });
  }

  if (!voiceScriptDoc) {
    return next(new AppError('No VoiceScript document found to synthesize speech.', 404));
  }

  const audioAssetDoc = await voiceService.synthesizeVoice(voiceScriptDoc);

  res.status(200).json({
    success: true,
    audioId: audioAssetDoc._id,
    scriptId: audioAssetDoc.scriptId,
    voicePath: audioAssetDoc.audioPath,
    duration: audioAssetDoc.duration
  });
});

export const getLatestVoiceScript = catchAsync(async (req, res, next) => {
  const scriptDoc = await VoiceScript.findOne().sort({ createdAt: -1 }).populate('captionId');
  if (!scriptDoc) {
    return next(new AppError('No VoiceScript found.', 404));
  }
  res.status(200).json({
    success: true,
    scriptId: scriptDoc._id,
    scriptText: scriptDoc.scriptText,
    captionId: scriptDoc.captionId
  });
});

export const getLatestAudio = catchAsync(async (req, res, next) => {
  const audioDoc = await AudioAsset.findOne().sort({ createdAt: -1 }).populate('scriptId');
  if (!audioDoc) {
    return next(new AppError('No AudioAsset found.', 404));
  }
  res.status(200).json({
    success: true,
    audioId: audioDoc._id,
    scriptId: audioDoc.scriptId,
    voicePath: audioDoc.audioPath,
    duration: audioDoc.duration
  });
});

