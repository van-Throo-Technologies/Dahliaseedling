import { getTranslation } from "@/i18n/server";

/** How to add DahliaSeedling to the home screen. Static text: the app does not detect the browser, so both routes are shown. */
export async function InstallGuidance() {
  const { t } = await getTranslation();
  return (
    <section
      aria-labelledby="install-title"
      className="flex flex-col gap-3 rounded-surface border border-border bg-surface p-4"
    >
      <h2 id="install-title" className="text-lg font-medium text-text">
        {t("launch.install.heading")}
      </h2>
      <p className="text-base text-text-muted">{t("launch.install.body")}</p>
      <div className="flex flex-col gap-1">
        <p className="text-base font-medium text-text">{t("launch.install.iosHeading")}</p>
        <p className="text-base text-text">{t("launch.install.ios")}</p>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-base font-medium text-text">{t("launch.install.androidHeading")}</p>
        <p className="text-base text-text">{t("launch.install.android")}</p>
      </div>
    </section>
  );
}
