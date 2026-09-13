package ru.genesis.calendar;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;

import androidx.annotation.Nullable;

import com.google.androidbrowserhelper.trusted.LauncherActivity;
import com.google.androidbrowserhelper.trusted.LauncherActivityMetadata;
import com.google.androidbrowserhelper.trusted.WebViewFallbackActivity;

/**
 * Starts GENESIS as a TWA and falls back to the bundled WebView screen when a
 * browser provider fails during startup. The stock launcher can otherwise
 * finish immediately, which looks like an application crash to the user.
 */
public final class ResilientLauncherActivity extends LauncherActivity {
    private static final String TAG = "GenesisLauncher";
    private boolean fallbackStarted;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        try {
            super.onCreate(savedInstanceState);
        } catch (RuntimeException launchError) {
            Log.e(TAG, "Trusted Web Activity startup failed; using WebView fallback", launchError);
            startWebViewFallback();
        }
    }

    private void startWebViewFallback() {
        if (fallbackStarted) {
            return;
        }
        fallbackStarted = true;

        Uri launchUri = Uri.parse(getString(R.string.launch_url));
        try {
            Intent fallbackIntent = WebViewFallbackActivity.createLaunchIntent(
                this,
                launchUri,
                LauncherActivityMetadata.parse(this)
            );
            startActivity(fallbackIntent);
        } catch (RuntimeException fallbackError) {
            Log.e(TAG, "WebView fallback failed; opening GENESIS in the default browser", fallbackError);
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, launchUri));
            } catch (RuntimeException browserError) {
                Log.e(TAG, "No browser is available to open GENESIS", browserError);
            }
        }
        finish();
    }
}
