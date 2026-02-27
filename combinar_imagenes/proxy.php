<?php
/**
 * ============================================
 * 🎨 COMBINAR IMÁGENES - PROXY PHP
 * Comunicación con Gemini API para fusión de imágenes
 * ============================================
 */

header('Content-Type: application/json; charset=utf-8');
ini_set('display_errors', 0);
error_reporting(E_ALL);

try {
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        throw new Exception('Método no permitido', 405);
    }

    $apiKey = getenv('D')
        ?: ($_SERVER['D']
            ?? $_SERVER['REDIRECT_D']
            ?? null);

    if (!$apiKey) {
        throw new Exception('Falta API Key de Gemini', 500);
    }

    $input = file_get_contents('php://input');
    $json = json_decode($input, true);

    if (!is_array($json)) {
        throw new Exception('JSON inválido o cuerpo vacío', 400);
    }

    $task = $json['task'] ?? '';
    $images = $json['images'] ?? [];
    $backgroundImage = $json['backgroundImage'] ?? null;
    $prompt = (string) ($json['prompt'] ?? '');
    $aspectRatio = $json['aspectRatio'] ?? '1:1';

    $callApi = function ($url, $body, $headers) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_POSTFIELDS => json_encode($body),
            CURLOPT_TIMEOUT => 180,
            CURLOPT_SSL_VERIFYPEER => false
        ]);

        $resp = curl_exec($ch);
        $status = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if ($resp === false) {
            throw new Exception('Error conexión cURL: ' . $err, 502);
        }

        $data = json_decode($resp, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new Exception('Respuesta no válida (no es JSON). Código: ' . $status, 502);
        }

        if ($status < 200 || $status >= 300) {
            $msg = $data['error']['message'] ?? $data['detail'] ?? ('Error HTTP ' . $status);
            throw new Exception('API Error: ' . $msg, $status);
        }

        return $data;
    };

    // ═══════════════════════════════════════════════
    // TAREA: MEJORAR PROMPT (MULTIMODAL)
    // ═══════════════════════════════════════════════
    if ($task === 'enhancePrompt') {
        $model = 'gemini-3-pro-image-preview';
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/'
            . rawurlencode($model)
            . ':generateContent?key='
            . urlencode($apiKey);

        $hasBackground = $json['hasBackground'] ?? false;

        $parts = [];

        if (!empty($images) && is_array($images)) {
            foreach ($images as $img) {
                if (!empty($img['data']) && !empty($img['mimeType'])) {
                    $parts[] = [
                        'inlineData' => [
                            'data' => $img['data'],
                            'mimeType' => $img['mimeType']
                        ]
                    ];
                }
            }
        }

        if ($hasBackground) {
            $sysText = "Analiza VISUALMENTE las imágenes proporcionadas (la primera es el FONDO ESTÁTICO).
Tu tarea es generar 4 prompts en español para insertar los sujetos en ese fondo EXACTO.

CRÍTICO:
1. El fondo NO DEBE CAMBIAR. Describe el fondo tal cual es (ej: 'en un parque con un puente de piedra').
2. Los sujetos deben integrarse con ESCALA REALISTA.
3. Prompt debe ser: 'Una foto realista de [sujetos] ubicados en [descripción exacta del fondo]...'.

El usuario quiere: '{$prompt}'.

Genera 4 variantes CORTAS (máximo 2 líneas) separadas por '|||'.";
        } else {
            $sysText = "Analiza VISUALMENTE las imágenes.
Genera 4 prompts realistas en español para combinarlas.
Mantén la identidad visual de los sujetos.

El usuario quiere: '{$prompt}'.

Genera 4 variantes CORTAS (máximo 2 líneas) separadas por '|||'.";
        }

        $parts[] = ['text' => $sysText];

        $body = [
            'contents' => [['role' => 'user', 'parts' => $parts]],
            'generationConfig' => ['responseModalities' => ['TEXT'], 'temperature' => 0.7]
        ];

        $data = $callApi($url, $body, ['Content-Type: application/json']);

        $text = '';
        if (isset($data['candidates'][0]['content']['parts'])) {
            foreach ($data['candidates'][0]['content']['parts'] as $p) {
                if (isset($p['text']))
                    $text .= $p['text'];
            }
        }

        if (empty($text))
            throw new Exception('Gemini no devolvió texto.', 500);

        $options = array_values(array_filter(array_map('trim', explode('|||', $text))));
        echo json_encode(['options' => $options]);
        exit;
    }

    // ═══════════════════════════════════════════════
    // TAREA: COMBINAR IMÁGENES
    // ═══════════════════════════════════════════════
    if ($task === 'combineImages') {

        if (count($images) < 1 && empty($backgroundImage)) {
            throw new Exception('Se necesitan imágenes para combinar', 400);
        }

        $model = 'gemini-3-pro-image-preview';
        $url = 'https://generativelanguage.googleapis.com/v1beta/models/'
            . rawurlencode($model)
            . ':generateContent?key='
            . urlencode($apiKey);

        $parts = [];

        $hasBackground = false;
        if ($backgroundImage && !empty($backgroundImage['data']) && !empty($backgroundImage['mimeType'])) {
            $hasBackground = true;
            $parts[] = [
                'inlineData' => [
                    'data' => $backgroundImage['data'],
                    'mimeType' => $backgroundImage['mimeType']
                ]
            ];
            // Instrucción explícita y contundente para el fondo
            $parts[] = [
                'text' => "IMAGEN 1 (FONDO): Esta imagen es el CANVAS OBJETIVO. \nNO LA MODIFIQUES.\nNO LA RECORTES.\nNO CAMBIES LA ILUMINACIÓN NI LOS ELEMENTOS.\nDEBES USARLA EXACTAMENTE COMO FONDO.\n"
            ];
        }

        foreach ($images as $img) {
            if (!empty($img['data']) && !empty($img['mimeType'])) {
                $parts[] = [
                    'inlineData' => [
                        'data' => $img['data'],
                        'mimeType' => $img['mimeType']
                    ]
                ];
            }
        }

        // Ingeniería de Prompt para Preservación Estricta
        $hyperRealistic = "ESTILO: FOTOGRAFÍA DOCUMENTAL 8K. NO ARTE DIGITAL. ";

        if ($hasBackground) {
            $fullPrompt = $hyperRealistic
                . "TAREA : COMPOSICIÓN DIGITAL (DIGITAL COMPOSITING). \n"
                . "INSTRUCCIONES SUPREMAS:\n"
                . "1. MANTÉN EL FONDO (Imagen 1) 100% INTACTO. Es una fotografía real que no debe ser alterada.\n"
                . "2. SOLO INSERTA a los sujetos de las otras imágenes sobre este fondo.\n"
                . "3. INTEGRACIÓN: Ajusta la luz y sombras de los SUJETOS para que coincidan con el fondo, pero NO TOQUES EL FONDO.\n"
                . "4. ESCALA: Los sujetos deben tener un tamaño LÓGICO Y REALISTA. Si el fondo es lejano, los sujetos son PEQUEÑOS.\n"
                . "PROMPT DE ACCIÓN: " . $prompt;
        } else {
            $fullPrompt = $hyperRealistic
                . "TAREA: FUSIÓN FOTOGRÁFICA.\n"
                . "INSTRUCCIONES: Combina los elementos en una escena coherente y realista.\n"
                . "PROMPT: " . $prompt;
        }

        $parts[] = ['text' => $fullPrompt];

        $genConfig = [
            'responseModalities' => ['IMAGE']
        ];

        if (!empty($aspectRatio)) {
            $genConfig['imageConfig'] = ['aspectRatio' => $aspectRatio];
        }

        $body = [
            'contents' => [['role' => 'user', 'parts' => $parts]],
            'generationConfig' => $genConfig
        ];

        $generatedImages = [];
        // Dos variaciones: Composición Integrada vs Primer Plano (si aplica)
        // Ojo: Si el usuario pide background estricto, las variaciones no deben cambiar el estilo del fondo.
        // Solo cambiaremos la POSICIÓN o la ACCIÓN de los sujetos.

        $variations = [
            " [Variación A: Los sujetos están situados de forma natural en la distancia media del escenario. Integración sutil.]",
            " [Variación B: Los sujetos están en primer plano o interactuando dinámicamente, pero el fondo sigue siendo el mismo.]"
        ];

        for ($i = 0; $i < 2; $i++) {
            try {
                $varBody = $body;
                $lastIdx = count($varBody['contents'][0]['parts']) - 1;
                $varBody['contents'][0]['parts'][$lastIdx]['text'] = $fullPrompt . $variations[$i];

                $data = $callApi($url, $varBody, ['Content-Type: application/json']);

                if (isset($data['candidates'][0]['content']['parts'])) {
                    foreach ($data['candidates'][0]['content']['parts'] as $part) {
                        if (isset($part['inlineData']['data'])) {
                            $imageData = $part['inlineData']['data'];
                            $mimeType = $part['inlineData']['mimeType'] ?? 'image/png';

                            if ($mimeType !== 'image/jpeg') {
                                $imageData = convertToJpg($imageData, $mimeType);
                            }

                            $generatedImages[] = [
                                'data' => $imageData,
                                'mimeType' => 'image/jpeg'
                            ];
                            break;
                        }
                    }
                }
            } catch (Exception $e) {
                if ($i === 1 && empty($generatedImages))
                    throw $e;
            }
        }

        if (empty($generatedImages)) {
            throw new Exception('Gemini no generó ninguna imagen', 500);
        }

        echo json_encode(['images' => $generatedImages]);
        exit;
    }

    throw new Exception('Tarea no reconocida: ' . $task, 400);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}

function convertToJpg($base64Data, $srcMimeType)
{
    $imageString = base64_decode($base64Data);
    $image = imagecreatefromstring($imageString);
    if ($image === false)
        return $base64Data;
    ob_start();
    imagejpeg($image, null, 95);
    $jpgData = ob_get_clean();
    imagedestroy($image);
    return base64_encode($jpgData);
}
?>