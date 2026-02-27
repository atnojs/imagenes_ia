<?php
header('Content-Type: application/json; charset=utf-8');
ini_set('display_errors', 0);
error_reporting(E_ALL);

try {
  if ($_SERVER['REQUEST_METHOD'] !== 'POST') throw new Exception('Método no permitido', 405);

  $apiKey = getenv('C')
    ?: ($_SERVER['C'] ?? $_SERVER['REDIRECT_C'] ?? null);

  $replicateKey = getenv('REPLICATE_API_FLUX') 
    ?: ($_SERVER['REPLICATE_API_FLUX'] ?? $_SERVER['REDIRECT_REPLICATE_API_TOKEN'] ?? null);

  $input = file_get_contents('php://input');
  $json = json_decode($input, true);
  if (!is_array($json)) throw new Exception('JSON inválido o cuerpo vacío', 400);

  $task        = $json['task'] ?? '';
  $provider    = $json['provider'] ?? 'gemini'; 
  $prompt      = (string)($json['prompt'] ?? '');
  $images      = $json['images'] ?? [];
  $maskImage   = $json['maskImage'] ?? null; 
  $aspectRatio = $json['aspectRatio'] ?? '1:1';
  $modalities  = $json['modalities'] ?? ['IMAGE']; 

  $callApi = function($url, $body, $headers) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_POST           => true,
      CURLOPT_HTTPHEADER     => $headers,
      CURLOPT_POSTFIELDS     => json_encode($body),
      CURLOPT_TIMEOUT        => 120,
      CURLOPT_SSL_VERIFYPEER => false 
    ]);
    $resp   = curl_exec($ch);
    $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $err    = curl_error($ch);
    curl_close($ch);

    if ($resp === false) throw new Exception('Error conexión cURL: ' . $err, 502);
    
    $data = json_decode($resp, true);
    if (json_last_error() !== JSON_ERROR_NONE) throw new Exception('Respuesta no válida del proveedor (no es JSON). Código: ' . $status, 502);

    if ($status < 200 || $status >= 300) {
       $msg = $data['error']['message'] ?? $data['detail'] ?? ('Error HTTP ' . $status);
       throw new Exception('API Error: ' . $msg, $status);
    }
    return $data;
  };

  // --- TAREA: MEJORAR PROMPT ---
  if ($task === 'enhancePrompt') {
    if (!$apiKey) throw new Exception('Falta API Key de Gemini', 500);
    $modelUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=' . urlencode($apiKey);
    $isMaskMode = $json['isMaskMode'] ?? false;

    if ($isMaskMode) {
        $sysPrompt = "Eres un experto en edición de imágenes (Inpainting). El usuario quiere editar una ZONA ESPECÍFICA (máscara). Genera 4 variantes del prompt en ESPAÑOL describiendo SOLO el contenido nuevo para la zona enmascarada para que se integre bien (iluminación, estilo). Separa con '|||'.";
    } else {
        $sysPrompt = "Eres un experto en prompts de arte IA. Genera 4 versiones mejoradas del prompt en ESPAÑOL. Separa con '|||'.";
    }
    
    $body = [
      'contents' => [[ 'role' => 'user', 'parts' => [[ 'text' => $sysPrompt . "\n\nPROMPT USUARIO: " . $prompt ]] ]],
      'generationConfig' => [ 'responseModalities' => ['TEXT'], 'temperature' => 0.7 ]
    ];
    $data = $callApi($modelUrl, $body, ['Content-Type: application/json']);
    $text = '';
    if (isset($data['candidates'][0]['content']['parts'])) {
        foreach ($data['candidates'][0]['content']['parts'] as $p) { if (isset($p['text'])) $text .= $p['text']; }
    }
    if (empty($text)) throw new Exception('Gemini no devolvió texto.', 500);
    $options = array_values(array_filter(array_map('trim', explode('|||', $text))));
    echo json_encode(['options' => $options]);
    exit;
  }

  // --- NUEVA TAREA: ANALIZAR POSICIÓN DE MÁSCARA ---
  if ($task === 'analyzeMaskPosition') {
      if (!$apiKey) throw new Exception('Falta API Key de Gemini', 500);
      
      // Usamos Flash para análisis rápido de visión
      $modelUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=' . urlencode($apiKey);
      
      // La imagen viene en $images[0]
      if (empty($images) || empty($images[0]['data'])) throw new Exception('No se recibió la imagen para analizar.', 400);

      $sysPrompt = "Eres un asistente de edición de imágenes. He marcado una o varias zonas con un color ROJO semitransparente en esta imagen.
      
      TU TAREA:
      Analiza dónde están situadas esas zonas rojas (izquierda, derecha, centro, arriba, fondo, primer plano, etc.).
      Genera una PLANTILLA DE PROMPT en ESPAÑOL para editar esas zonas.
      Usa marcadores entre corchetes como [DESCRIBE AQUÍ] para que yo rellene el contenido.
      
      EJEMPLO DE SALIDA:
      'Añade [DESCRIBE OBJETO] en la zona roja a la derecha y [DESCRIBE OBJETO] en la zona roja de la izquierda, manteniendo la iluminación natural.'
      
      Responde SOLO con la plantilla de texto, nada más.";

      $parts = [
          ['text' => $sysPrompt],
          ['inlineData' => ['data' => $images[0]['data'], 'mimeType' => $images[0]['mimeType']]]
      ];

      $body = [
        'contents' => [[ 'role' => 'user', 'parts' => $parts ]],
        'generationConfig' => [ 'responseModalities' => ['TEXT'], 'temperature' => 0.4 ]
      ];

      $data = $callApi($modelUrl, $body, ['Content-Type: application/json']);
      
      $textResponse = '';
      if(isset($data['candidates'][0]['content']['parts'])) {
          foreach ($data['candidates'][0]['content']['parts'] as $p) {
              if (isset($p['text'])) $textResponse .= $p['text'];
          }
      }

      if (empty($textResponse)) throw new Exception('No se pudo generar la plantilla.', 500);

      echo json_encode(['template' => trim($textResponse)]);
      exit;
  }

  // --- TAREA: GENERAR IMAGEN ---
  if ($task === 'generateImage') {
    if ($provider === 'flux') {
        if (!$replicateKey) throw new Exception('Falta token de Replicate (flux)', 500);
        $url = "https://api.replicate.com/v1/models/black-forest-labs/flux-2-pro/predictions";
        $body = [
            'input' => [
                'prompt' => $prompt,
                'aspect_ratio' => $aspectRatio ?: "1:1",
                'output_format' => "jpg",
                'output_quality' => 90,
                'safety_tolerance' => 5
            ]
        ];
        $headers = [ "Authorization: Bearer $replicateKey", "Content-Type: application/json", "Prefer: wait" ];
        $data = $callApi($url, $body, $headers);
        $imageUrl = $data['output'] ?? null;
        if (!$imageUrl) throw new Exception('Flux no devolvió imagen.', 502);
        $imgData = file_get_contents($imageUrl);
        echo json_encode(['image' => base64_encode($imgData), 'mimeType' => 'image/jpeg', 'type' => 'image']);
        exit;
    } else {
        if (!$apiKey) throw new Exception('Falta API Key de Gemini', 500);
        
        $model = 'gemini-3-pro-image-preview'; 
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/' . rawurlencode($model) . ':generateContent?key=' . urlencode($apiKey);

        $parts = [];
        foreach ($images as $img) {
            if (!empty($img['data']) && !empty($img['mimeType'])) {
                $parts[] = ['inlineData' => ['data' => $img['data'], 'mimeType' => $img['mimeType']]];
            }
        }
        if ($maskImage && !empty($maskImage['data']) && !empty($maskImage['mimeType'])) {
             $parts[] = ['inlineData' => ['data' => $maskImage['data'], 'mimeType' => $maskImage['mimeType']]];
        }
        $parts[] = ['text' => $prompt];

        $genConfig = [ 'responseModalities' => $modalities ];
        if (in_array('IMAGE', $modalities) && !empty($aspectRatio)) {
            $genConfig['imageConfig'] = ['aspectRatio' => $aspectRatio];
        }

        $body = [
          'contents' => [[ 'role' => 'user', 'parts' => $parts ]],
          'generationConfig' => $genConfig
        ];

        $data = $callApi($url, $body, ['Content-Type: application/json']);

        $imageB64 = null; $mime = 'image/png';
        if(isset($data['candidates'][0]['content']['parts'])) {
            foreach ($data['candidates'][0]['content']['parts'] as $p) {
                if (isset($p['inlineData']['data'])) {
                    $imageB64 = $p['inlineData']['data'];
                    $mime = $p['inlineData']['mimeType'] ?? 'image/png';
                    break;
                }
            }
        }

        if ($imageB64) { 
            echo json_encode(['image' => $imageB64, 'mimeType' => $mime, 'type' => 'image']); 
            exit; 
        }

        $textResponse = '';
        if(isset($data['candidates'][0]['content']['parts'])) {
            foreach ($data['candidates'][0]['content']['parts'] as $p) {
                if (isset($p['text'])) $textResponse .= $p['text'];
            }
        }
        
        if ($textResponse) { 
            echo json_encode(['text' => $textResponse, 'type' => 'text']); 
            exit; 
        }
        throw new Exception('Gemini no generó imagen ni texto. Motivo: ' . ($data['promptFeedback']['blockReason'] ?? 'Desconocido'));
    }
  }
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['error' => $e->getMessage()]);
}
?>