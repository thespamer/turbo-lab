import { Button } from "@repo/ui";
import { formatName } from "@repo/utils";
import "./App.css";

function App() {
  return (
    <>
      <h1>{formatName("Juliano")}</h1>
      <p>{Button("Entrar")}</p>
    </>
  );
}

export default App;
