param(
    [string]$Dataset = "eval/notive_retrieval.sample.json",
    [string[]]$Model = @(
        "sentence-transformers/all-MiniLM-L6-v2",
        "BAAI/bge-small-en-v1.5"
    ),
    [string]$Reranker = "cross-encoder/ms-marco-MiniLM-L6-v2",
    [int]$RerankTopK = 20,
    [string]$Output = ""
)

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$datasetPath = Join-Path $scriptRoot $Dataset
$scriptPath = Join-Path $scriptRoot "scripts\evaluate_retrieval.py"

$arguments = @($scriptPath, "--dataset", $datasetPath)

foreach ($entry in $Model) {
    $arguments += @("--model", $entry)
}

if ($Reranker) {
    $arguments += @("--reranker", $Reranker, "--rerank-top-k", "$RerankTopK")
}

if ($Output) {
    $outputPath = Join-Path $scriptRoot $Output
    $arguments += @("--output", $outputPath)
}

python @arguments
