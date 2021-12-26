// Protocol:
// SHORT: number of fields
// SHORT: field number
// BYTE: type union index
// Variable: value
// After all fields: BYTE: Continuation marker for extended message (needed because extended messages have their own field numbers)
