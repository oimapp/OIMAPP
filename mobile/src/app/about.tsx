import React from "react";
import { AboutContent } from "@/components/About";
import { SubScreen } from "@/components/ui";
import { useApp } from "@/lib/app";

export default function About() {
  const { t } = useApp();
  return (
    <SubScreen title={t("about")}>
      <AboutContent />
    </SubScreen>
  );
}
