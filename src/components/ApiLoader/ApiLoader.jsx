import { useEffect, useRef } from "react";
import { Backdrop, Box } from "@mui/material";
import lottie from "lottie-web";
import loaderAnimation from "../../assets/loader.json";
import useApiLoader from "../../hooks/useApiLoader";
import "./ApiLoader.css";

export default function ApiLoader() {
  const isLoading = useApiLoader();
  const animationContainer = useRef(null);

  useEffect(() => {
    if (!isLoading || !animationContainer.current) return undefined;

    const animation = lottie.loadAnimation({
      container: animationContainer.current,
      renderer: "svg",
      loop: true,
      autoplay: true,
      animationData: loaderAnimation,
      rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
    });

    return () => animation.destroy();
  }, [isLoading]);

  return (
    <Backdrop
      className="api-loader"
      open={isLoading}
      aria-live="polite"
      aria-label="Loading"
      aria-busy={isLoading}
    >
      <Box className="api-loader__animation" ref={animationContainer} role="img" aria-label="Loading" />
    </Backdrop>
  );
}