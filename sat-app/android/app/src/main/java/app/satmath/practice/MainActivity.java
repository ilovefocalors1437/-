package app.satmath.practice;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Thin shell: the whole app is the offline web app in assets/www. */
public class MainActivity extends Activity {
    private WebView web;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // localStorage: autosave + history
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setSupportZoom(false);
        s.setTextZoom(100);
        s.setMediaPlaybackRequiresUserGesture(true);
        web.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if ("file".equals(u.getScheme())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }
        });
        setContentView(web);
        if (savedInstanceState == null) web.loadUrl("file:///android_asset/www/index.html");
        else web.restoreState(savedInstanceState);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    protected void onPause() {
        // Tell the page first so it pauses the clock and saves, then suspend the WebView.
        web.evaluateJavascript("window.__sat&&window.__sat.pause&&window.__sat.pause()", null);
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    public void onBackPressed() {
        web.evaluateJavascript("(window.onAndroidBack&&window.onAndroidBack())?1:0", value -> {
            if (!"1".equals(value)) finish();
        });
    }
}
