type StartsWithCode = {
  startCode: string;
  endCode: string;
};
export const getStartsWithCode = (str: string): StartsWithCode => {
  const strLength = str.length;
  const strFrontUniCode = str.slice(0, strLength - 1);
  const strEndUniCode = str.slice(strLength - 1, strLength);
  const startCode = str;
  const endCode =
    strFrontUniCode + String.fromCharCode(strEndUniCode.charCodeAt(0) + 1);
  console.log(
    `str : ${str}, strLength : ${strLength}, strFrontUniCode : ${strFrontUniCode}, strEndUniCode : ${strEndUniCode}, startCode : ${startCode}, endCode : ${startCode}`
  );
  return {
    startCode: startCode,
    endCode: endCode,
  };
};
