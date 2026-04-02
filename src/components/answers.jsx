import { checkHeading, replaceHeadingStarts } from "../helper";

const Answer = ({ ans, totalResult, index, type }) => {
  const isHeading = checkHeading(ans);
  const finalAnswer = isHeading ? replaceHeadingStarts(ans) : ans;

  return (
    <>
      {totalResult > 1 ? (
        <span className="pt-2 text-lg block text-white">
          {finalAnswer}
        </span>
      ) : isHeading ? (
        <span className="pt-2 text-lg block text-white">
          {finalAnswer}
        </span>
      ) : (
        <span className={type === "q" ? "pl-1" : "pl-5"}>
          {finalAnswer}
        </span>
      )}
    </>
  );
};

export default Answer;
