/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');

function replaceExactlyOnce(content, searchValue, replaceValue, label) {
  const occurrences = content.split(searchValue).length - 1;
  if (occurrences !== 1) {
    throw new Error(`${label}: expected exactly 1 occurrence, found ${occurrences}`);
  }
  return content.replace(searchValue, replaceValue);
}

function patchFile(targetPath, patches) {
  let content = fs.readFileSync(targetPath, 'utf8');
  let changed = false;

  for (const patch of patches) {
    if (content.includes(patch.after)) {
      continue;
    }
    content = replaceExactlyOnce(content, patch.before, patch.after, patch.label);
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(targetPath, content, 'utf8');
    console.log(`[postinstall] patched ${path.relative(process.cwd(), targetPath)}`);
  } else {
    console.log(`[postinstall] already patched ${path.relative(process.cwd(), targetPath)}`);
  }
}

try {
  const rnRoot = path.join(__dirname, '..', 'node_modules', 'react-native', 'ReactAndroid', 'src', 'main');

  patchFile(
    path.join(rnRoot, 'java', 'com', 'facebook', 'react', 'modules', 'statusbar', 'StatusBarModule.kt'),
    [
      {
        label: 'StatusBarModule imports',
        before: `import android.animation.ArgbEvaluator
import android.animation.ValueAnimator
import android.os.Build
import android.view.View
import android.view.WindowInsetsController
import android.view.WindowManager
`,
        after: `import android.os.Build
import android.view.View
import android.view.WindowInsetsController
`,
      },
      {
        label: 'StatusBarModule exported constants',
        before: `  @Suppress("DEPRECATION")
  override fun getTypedExportedConstants(): Map<String, Any> {
    val currentActivity = reactApplicationContext.currentActivity
    val statusBarColor =
        currentActivity?.window?.statusBarColor?.let { color ->
          String.format("#%06X", 0xFFFFFF and color)
        } ?: "black"
    return mapOf(
        HEIGHT_KEY to PixelUtil.toDIPFromPixel(getStatusBarHeightPx(currentActivity).toFloat()),
        DEFAULT_BACKGROUND_COLOR_KEY to statusBarColor,
    )
  }
`,
        after: `  @Suppress("DEPRECATION")
  override fun getTypedExportedConstants(): Map<String, Any> {
    val currentActivity = reactApplicationContext.currentActivity
    return mapOf(
        HEIGHT_KEY to PixelUtil.toDIPFromPixel(getStatusBarHeightPx(currentActivity).toFloat()),
        DEFAULT_BACKGROUND_COLOR_KEY to "black",
    )
  }
`,
      },
      {
        label: 'StatusBarModule setColor implementation',
        before: `  @Suppress("DEPRECATION")
  override fun setColor(colorDouble: Double, animated: Boolean) {
    val color = colorDouble.toInt()
    val activity = currentActivity
    if (activity == null) {
      FLog.w(
          ReactConstants.TAG,
          "StatusBarModule: Ignored status bar change, current activity is null.")
      return
    }
    UiThreadUtil.runOnUiThread(
        object : GuardedRunnable(reactApplicationContext) {
          override fun runGuarded() {
            val window = activity.window ?: return
            window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
            if (animated) {
              val curColor = window.statusBarColor
              val colorAnimation = ValueAnimator.ofObject(ArgbEvaluator(), curColor, color)
              colorAnimation.addUpdateListener { animator ->
                activity.window?.statusBarColor = (animator.animatedValue as Int)
              }
              colorAnimation.setDuration(300).startDelay = 0
              colorAnimation.start()
            } else {
              window.statusBarColor = color
            }
          }
        })
  }
`,
        after: `  override fun setColor(colorDouble: Double, animated: Boolean) {
    FLog.d(
        ReactConstants.TAG,
        "StatusBarModule: Ignoring status bar color changes to avoid deprecated Android 15 APIs.")
  }
`,
      },
    ]
  );

  patchFile(
    path.join(rnRoot, 'java', 'com', 'facebook', 'react', 'views', 'view', 'WindowUtil.kt'),
    [
      {
        label: 'WindowUtil imports',
        before: `import android.content.res.Configuration
import android.graphics.Color
import android.os.Build
`,
        after: `import android.content.res.Configuration
import android.os.Build
`,
      },
      {
        label: 'WindowUtil.statusBarHide cutout mode',
        before: `    attributes.layoutInDisplayCutoutMode =
        WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
    setDecorFitsSystemWindows(false)
`,
        after: `    attributes.layoutInDisplayCutoutMode =
        WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
    WindowCompat.setDecorFitsSystemWindows(this, false)
`,
      },
      {
        label: 'WindowUtil.statusBarShow cutout mode',
        before: `    attributes.layoutInDisplayCutoutMode =
        WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_DEFAULT
    setDecorFitsSystemWindows(true)
`,
        after: `    attributes.layoutInDisplayCutoutMode =
        WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
    WindowCompat.setDecorFitsSystemWindows(this, true)
`,
      },
      {
        label: 'WindowUtil.setSystemBarsTranslucency colors and cutout mode',
        before: `    statusBarColor = Color.TRANSPARENT
    navigationBarColor =
        when {
          Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q -> Color.TRANSPARENT
          Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1 && !isDarkMode ->
              Color.argb(0xe6, 0xFF, 0xFF, 0xFF)
          else -> Color.argb(0x80, 0x1b, 0x1b, 0x1b)
        }

    WindowInsetsControllerCompat(this, this.decorView).run {
      isAppearanceLightNavigationBars = !isDarkMode
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      attributes.layoutInDisplayCutoutMode =
          when {
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.R ->
                WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
            else -> WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
          }
    }
`,
        after: `    WindowInsetsControllerCompat(this, this.decorView).run {
      isAppearanceLightNavigationBars = !isDarkMode
    }

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      attributes.layoutInDisplayCutoutMode =
          WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
    }
`,
      },
    ]
  );

  patchFile(
    path.join(rnRoot, 'res', 'views', 'modal', 'values', 'themes.xml'),
    [
      {
        label: 'React Native modal theme statusBarColor attribute',
        before: `    <item name="android:windowDrawsSystemBarBackgrounds">true</item>
    <item name="android:statusBarColor">@android:color/transparent</item>
`,
        after: `    <item name="android:windowDrawsSystemBarBackgrounds">true</item>
`,
      },
    ]
  );
} catch (error) {
  console.warn('[postinstall] fix-react-native-android15-edge-to-edge failed:', error && error.message ? error.message : String(error));
  process.exitCode = 1;
}